import { Effect } from 'effect';
import type { RequestHandler } from './$types';
import { eq } from 'drizzle-orm';
import { poll_batch_shloka_image_gen_func } from '~/api/routes/batch_ai_image';
import { poll_batch_text_translation_func } from '~/api/routes/batch_ai_text';
import { BATCH_POLLING_INTERVAL_S, MAX_BATCH_POLL_ATTEMPTS } from '~/utils/types/ai_batch_metadata';
import { ai_batches } from '~/db/schema';
import { runQstashEffect } from '~/effect/app_runtime.server';
import { dbRun } from '~/effect/database';
import { BatchError, ValidationError } from '~/effect/errors';
import {
  QStashPublisher,
  aiBatchResultsPayloadSchema,
  decodeQstashPayload,
  verifyQstashSignature,
  type JsonValue
} from '~/effect/qstash';

export const POST: RequestHandler = async ({ request }) => {
  const signature = request.headers.get('upstash-signature') ?? '';
  const body_text = await request.text();

  return runQstashEffect(
    Effect.gen(function* () {
      yield* verifyQstashSignature(signature, body_text);

      console.log('QStash AI batch poll request received', new Date());
      // SAFETY: JSON.parse of the signature-verified request body always yields a JSON value.
      const raw = yield* Effect.try({
        try: () => JSON.parse(body_text) as JsonValue,
        catch: (cause) => ValidationError.make({ message: 'Invalid QStash JSON body', cause })
      });
      const body = yield* decodeQstashPayload(aiBatchResultsPayloadSchema, raw);
      const { batch_id, poll_attempt } = body;

      if (poll_attempt >= MAX_BATCH_POLL_ATTEMPTS) {
        // Preserve failed/expired inspection in DB; stop automation after ~24h.
        console.warn(
          `AI batch ${batch_id} stalled: exhausted poll attempts (${poll_attempt}/${MAX_BATCH_POLL_ATTEMPTS}); manual attention required`
        );
        return `Batch ${batch_id} exceeded max poll attempts (${MAX_BATCH_POLL_ATTEMPTS})`;
      }

      const batch_row = yield* dbRun('qstash.batch.lookup', (db) =>
        db.query.ai_batches.findFirst({
          columns: { type: true },
          where: eq(ai_batches.batch_id, batch_id)
        })
      );

      // Missing batch after cleanup is a successful no-op.
      if (!batch_row) {
        return `Batch ${batch_id} already resolved or cleaned up`;
      }

      const result = yield* Effect.tryPromise({
        try: () =>
          batch_row.type === 'object'
            ? poll_batch_text_translation_func(batch_id)
            : poll_batch_shloka_image_gen_func(batch_id),
        catch: (cause) =>
          BatchError.make({ operation: 'qstash.poll_batch', batchId: batch_id, cause })
      });

      if (result.status === 'already_resolved') {
        return `Batch ${batch_id} already resolved`;
      }

      if (result.status === 'pending') {
        const qstash = yield* QStashPublisher;
        yield* qstash.publishAiBatchResults(
          { batch_id, poll_attempt: poll_attempt + 1 },
          BATCH_POLLING_INTERVAL_S
        );
        return `Batch ${batch_id} still ${result.openai_status}; next poll scheduled in ${BATCH_POLLING_INTERVAL_S}s (attempt ${poll_attempt + 1}/${MAX_BATCH_POLL_ATTEMPTS})`;
      }

      if (result.status === 'terminal_failure') {
        return `Batch ${batch_id} failed with status ${result.openai_status}`;
      }

      const succeeded = result.items.filter((item) => item.success).length;
      return `Batch ${batch_id} processed: ${succeeded}/${result.items.length} items succeeded`;
    }),
    {
      onSuccess: (message) => new Response(message, { status: 200 })
    }
  );
};
