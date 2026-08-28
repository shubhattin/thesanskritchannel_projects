import { and, eq, sql } from 'drizzle-orm';
import { Effect } from 'effect';
import ms from 'ms';
import { z } from 'zod';
import { ai_batches, ai_batch_responses } from '~/db/schema';
import { OpenAiBatchClient } from '~/effect/ai';
import { enqueueBackground } from '~/effect/background';
import { Database, dbRun, dbTransaction, type TxOrDb } from '~/effect/database';
import { BatchError } from '~/effect/errors';
import { QStashPublisher } from '~/effect/qstash';
import { createAiBatch, type AiBatchInput } from '~/utils/ai_batch';
import {
  BATCH_POLLING_INTERVAL_S,
  batch_metadata_schema,
  type BatchMetadata
} from '~/utils/types/ai_batch_metadata';

const POLL_CLAIM_STALE_MS = ms('12mins');

export const responseItemUnprocessed = sql`${ai_batch_responses.metadata}->>'success' IS NULL`;

/** Bounded parallelism — avoids Neon/Upstash stampedes on large batches. */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  if (items.length === 0) return [];
  const results: R[] = [];
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, async () => {
      while (true) {
        const i = next++;
        if (i >= items.length) return;
        results[i] = await mapper(items[i]!, i);
      }
    })
  );
  return results;
}

/** `status` of OpenAI SDK errors (APIError sets it as an own enumerable property); `undefined` when absent. */
const openaiStatus = (cause: unknown): number | undefined => {
  const parsed = z.object({ status: z.number() }).loose().safeParse(cause);
  return parsed.success ? parsed.data.status : undefined;
};

/** Delete OpenAI Files API objects (batch input/output). Ignores already-deleted files. */
export const deleteOpenAiFiles = Effect.fn('deleteOpenAiFiles')(function* (
  file_ids: (string | null | undefined)[]
) {
  const { client } = yield* OpenAiBatchClient;
  const unique_ids = [...new Set(file_ids.filter((id): id is string => !!id))];
  yield* Effect.tryPromise({
    try: async () => {
      await Promise.all(
        unique_ids.map(async (file_id) => {
          try {
            await client.files.delete(file_id);
          } catch (err) {
            // OpenAI often expires/removes batch files before we clean up — 404 is expected.
            if (openaiStatus(err) === 404) return;
            throw err;
          }
        })
      );
    },
    catch: (cause) => BatchError.make({ operation: 'deleteOpenAiFiles', cause })
  });
});

/** Delete OpenAI input/output files and the ai_batches row (cascade-deletes responses). */
export const discardAiBatchEntirely = Effect.fn('discardAiBatchEntirely')(function* (
  batch_id: string
) {
  const batch = yield* dbRun('batch.discard.lookup', (db) =>
    db.query.ai_batches.findFirst({
      columns: { input_file_id: true, output_file_id: true },
      where: eq(ai_batches.batch_id, batch_id)
    })
  );
  if (!batch) return false;

  // Remote files first so a failure keeps the DB row for retry.
  yield* deleteOpenAiFiles([batch.input_file_id, batch.output_file_id]);
  yield* dbRun('batch.discard.delete', async (db) => {
    await db.delete(ai_batches).where(eq(ai_batches.batch_id, batch_id));
  });
  return true;
});

export const scheduleOpenAiBatchCleanup = Effect.fn('scheduleOpenAiBatchCleanup')(function* (
  batch_id: string
) {
  const database = yield* Database;
  const openai = yield* OpenAiBatchClient;

  yield* enqueueBackground(() =>
    Effect.runPromise(
      Effect.gen(function* () {
        const remaining = yield* database.run('batch.cleanup.check', (db) =>
          db.query.ai_batch_responses.findFirst({
            columns: { batch_id: true },
            where: eq(ai_batch_responses.batch_id, batch_id)
          })
        );
        if (remaining) return;

        const batch = yield* database.run('batch.cleanup.lookup', (db) =>
          db.query.ai_batches.findFirst({
            columns: { input_file_id: true, output_file_id: true },
            where: eq(ai_batches.batch_id, batch_id)
          })
        );
        if (!batch) return;

        const unique_ids = [
          ...new Set([batch.input_file_id, batch.output_file_id].filter((id): id is string => !!id))
        ];
        yield* Effect.tryPromise({
          try: async () => {
            await Promise.all(
              unique_ids.map(async (file_id) => {
                try {
                  await openai.client.files.delete(file_id);
                } catch (err) {
                  if (openaiStatus(err) === 404) return;
                  throw err;
                }
              })
            );
          },
          catch: (cause) => BatchError.make({ operation: 'deleteOpenAiFiles', cause })
        });

        yield* database.run('batch.cleanup.delete', async (db) => {
          await db.delete(ai_batches).where(eq(ai_batches.batch_id, batch_id));
        });
      })
    ).catch((err) => {
      console.error(`Failed OpenAI batch file cleanup for batch ${batch_id}:`, err);
    })
  );
});

/** Compact debug payload for metadata.error (not full OpenAI bodies). */
export function batchFailureError(
  reason: string,
  extra?: Record<string, string | number | undefined>
) {
  return { reason, ...extra };
}

export function errMessage(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}

/**
 * Lock and mark a source batch as retrying. The source stays intact until the
 * replacement batch is persisted, so enqueue failures remain recoverable.
 */
export const claimBatchForRetry = <T>(args: {
  batch_id: string;
  batch_type: 'image' | 'object';
  validateAndMap: (
    batch: typeof ai_batches.$inferSelect,
    responses: (typeof ai_batch_responses.$inferSelect)[]
  ) => T | Promise<T>;
}) =>
  dbTransaction('batch.claim_for_retry', async (tx) => {
    const batches = await tx
      .select()
      .from(ai_batches)
      .where(and(eq(ai_batches.batch_id, args.batch_id), eq(ai_batches.type, args.batch_type)))
      .for('update')
      .limit(1);
    const batch = batches[0];
    if (!batch) {
      throw new Error('BATCH_NOT_FOUND');
    }

    const responses = await tx
      .select()
      .from(ai_batch_responses)
      .where(eq(ai_batch_responses.batch_id, args.batch_id))
      .for('update');

    const mapped = await args.validateAndMap(batch, responses);

    const retry_claimed_at = new Date().toISOString();
    for (const response of responses) {
      const metadata = batch_metadata_schema.parse(response.metadata);
      await tx
        .update(ai_batch_responses)
        .set({ metadata: { ...metadata, retry_claimed_at } })
        .where(
          and(
            eq(ai_batch_responses.batch_id, args.batch_id),
            eq(ai_batch_responses.custom_id, response.custom_id)
          )
        );
    }

    return {
      mapped,
      input_file_id: batch.input_file_id,
      output_file_id: batch.output_file_id
    };
  });

export const releaseBatchRetryClaim = Effect.fn('releaseBatchRetryClaim')(function* (
  batch_id: string
) {
  yield* dbRun('batch.release_retry_claim', async (db) => {
    await db.execute(sql`
      UPDATE ${ai_batch_responses}
      SET metadata = metadata - 'retry_claimed_at'
      WHERE batch_id = ${batch_id}
    `);
  });
});

export function isResponseItemProcessed(metadata: BatchMetadata): boolean {
  return metadata.success !== undefined;
}

/** Create OpenAI batch, persist rows, schedule poll — rollback OpenAI+DB on insert failure. */
export const enqueueAiBatch = Effect.fn('enqueueAiBatch')(function* (args: {
  batch_type: 'image' | 'object';
  batch_requests: AiBatchInput[];
  response_rows: {
    custom_id: string;
    auto_approved: boolean;
    metadata: BatchMetadata;
  }[];
}) {
  const { batch_type, batch_requests, response_rows } = args;
  if (batch_requests.length === 0 || response_rows.length === 0) {
    return yield* Effect.fail(
      BatchError.make({
        operation: 'enqueueAiBatch',
        cause: new Error('enqueueAiBatch requires at least one request/response row')
      })
    );
  }
  if (batch_requests.length !== response_rows.length) {
    return yield* Effect.fail(
      BatchError.make({
        operation: 'enqueueAiBatch',
        cause: new Error('enqueueAiBatch request/response row counts must match')
      })
    );
  }

  const { client } = yield* OpenAiBatchClient;
  const qstash = yield* QStashPublisher;
  const database = yield* Database;

  const { batch_id, input_file_id } = yield* Effect.tryPromise({
    try: () => createAiBatch(client, batch_requests),
    catch: (cause) => BatchError.make({ operation: 'createAiBatch', cause })
  });

  try {
    yield* database.transaction('batch.enqueue.insert', async (tx) => {
      await tx.insert(ai_batches).values({
        batch_id,
        type: batch_type,
        input_file_id
      });
      await tx.insert(ai_batch_responses).values(
        response_rows.map((row) => ({
          batch_id,
          custom_id: row.custom_id,
          auto_approved: row.auto_approved,
          metadata: row.metadata
        }))
      );
    });
    yield* qstash.publishAiBatchResults({ batch_id, poll_attempt: 0 }, BATCH_POLLING_INTERVAL_S);
  } catch (err) {
    yield* Effect.promise(() =>
      Effect.runPromise(
        database.run('batch.enqueue.cleanup_responses', async (db) => {
          await db.delete(ai_batch_responses).where(eq(ai_batch_responses.batch_id, batch_id));
        })
      ).catch((cleanup_err) => {
        console.error(`Failed to delete orphaned batch responses ${batch_id}:`, cleanup_err);
      })
    );
    yield* Effect.promise(() =>
      Effect.runPromise(
        database.run('batch.enqueue.cleanup_batch', async (db) => {
          await db.delete(ai_batches).where(eq(ai_batches.batch_id, batch_id));
        })
      ).catch((cleanup_err) => {
        console.error(`Failed to delete orphaned ai_batches row ${batch_id}:`, cleanup_err);
      })
    );
    yield* Effect.promise(() =>
      client.batches.cancel(batch_id).catch((cancel_err) => {
        console.error(`Failed to cancel orphaned OpenAI batch ${batch_id}:`, cancel_err);
      })
    );
    return yield* Effect.fail(
      BatchError.make({ operation: 'enqueueAiBatch', batchId: batch_id, cause: err })
    );
  }

  return { batch_id, item_count: response_rows.length };
});

export const tryClaimBatchRow = Effect.fn('tryClaimBatchRow')(function* (
  batch_id: string,
  custom_id: string
) {
  return yield* dbTransaction('batch.try_claim_row', async (tx) => {
    const rows = await tx
      .select()
      .from(ai_batch_responses)
      .where(
        and(
          eq(ai_batch_responses.batch_id, batch_id),
          eq(ai_batch_responses.custom_id, custom_id),
          responseItemUnprocessed
        )
      )
      .for('update')
      .limit(1);

    const row = rows[0];
    if (!row) return null;

    const metadata = batch_metadata_schema.parse(row.metadata);
    if (metadata.poll_claimed_at) {
      const claimed_at = Date.parse(metadata.poll_claimed_at);
      if (!Number.isNaN(claimed_at) && Date.now() - claimed_at < POLL_CLAIM_STALE_MS) {
        return null;
      }
    }

    const claimed_metadata = { ...metadata, poll_claimed_at: new Date().toISOString() };
    const updated = await tx
      .update(ai_batch_responses)
      .set({ metadata: claimed_metadata })
      .where(
        and(
          eq(ai_batch_responses.batch_id, batch_id),
          eq(ai_batch_responses.custom_id, custom_id),
          responseItemUnprocessed
        )
      )
      .returning();

    if (updated.length === 0) return null;
    return { ...row, metadata: claimed_metadata };
  });
});

export async function updateBatchResponse(
  tx: TxOrDb,
  batch_id: string,
  custom_id: string,
  metadata: BatchMetadata,
  output_file_id?: string | null
): Promise<boolean> {
  const updated = await tx
    .update(ai_batch_responses)
    .set({ metadata })
    .where(
      and(
        eq(ai_batch_responses.batch_id, batch_id),
        eq(ai_batch_responses.custom_id, custom_id),
        responseItemUnprocessed
      )
    )
    .returning();

  if (updated.length === 0) return false;

  if (output_file_id != null) {
    await tx.update(ai_batches).set({ output_file_id }).where(eq(ai_batches.batch_id, batch_id));
  }
  return true;
}

/** Bulk-mark unprocessed responses as failed in one statement (avoids N updates / same-tx Promise.all). */
export async function bulkFailUnprocessedBatchResponses(
  tx: TxOrDb,
  batch_id: string,
  rows: { custom_id: string; metadata: BatchMetadata }[],
  output_file_id?: string | null
) {
  if (rows.length === 0) return;

  const value_rows = rows.map(
    (row) =>
      sql`(${row.custom_id}::text, ${JSON.stringify({ ...row.metadata, success: false })}::jsonb)`
  );
  // Single statement — do not Promise.all on the same tx connection (neon/postgres-js).
  await tx.execute(sql`
    UPDATE ${ai_batch_responses} AS t
    SET metadata = v.metadata
    FROM (VALUES ${sql.join(value_rows, sql`, `)}) AS v(custom_id, metadata)
    WHERE t.batch_id = ${batch_id}
      AND t.custom_id = v.custom_id
      AND t.metadata->>'success' IS NULL
  `);

  if (output_file_id != null) {
    await tx.update(ai_batches).set({ output_file_id }).where(eq(ai_batches.batch_id, batch_id));
  }
}

export async function markBatchOutputResolvedIfComplete(
  tx: TxOrDb,
  batch_id: string,
  output_file_id?: string | null
) {
  const responses = await tx.query.ai_batch_responses.findMany({
    where: eq(ai_batch_responses.batch_id, batch_id),
    columns: { metadata: true }
  });
  const all_processed = responses.every((row) =>
    isResponseItemProcessed(batch_metadata_schema.parse(row.metadata))
  );
  if (!all_processed) return;

  await tx
    .update(ai_batches)
    .set(
      output_file_id != null ? { output_resolved: true, output_file_id } : { output_resolved: true }
    )
    .where(and(eq(ai_batches.batch_id, batch_id), eq(ai_batches.output_resolved, false)));
}
