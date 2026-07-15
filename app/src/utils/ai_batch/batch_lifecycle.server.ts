import { OpenAI } from 'openai';
import { and, eq, sql } from 'drizzle-orm';
import ms from 'ms';
import { waitUntil } from '@vercel/functions';
import { db, type transactionType } from '~/db/db';
import { ai_batches, ai_batch_responses } from '~/db/schema';
import { createAiBatch, type AiBatchInput } from '~/utils/ai_batch';
import {
  BATCH_POLLING_INTERVAL_S,
  batch_metadata_schema,
  type BatchMetadata
} from '~/utils/types/ai_batch_metadata';
import { publishAiBatchResultsQueue } from '~/utils/qstash';
import { env } from '$env/dynamic/private';

/** Lazy: avoid SDK constructors during SvelteKit postbuild analyse (private env empty). */
let openai: OpenAI | undefined;
export const getOpenAI = () => (openai ??= new OpenAI({ apiKey: env.OPENAI_API_KEY }));

const POLL_CLAIM_STALE_MS = ms('12mins');

export const responseItemUnprocessed = sql`${ai_batch_responses.metadata}->>'success' IS NULL`;

/** Bounded parallelism — avoids Neon/Upstash stampedes on large batches. */
export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  concurrency: number,
  mapper: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  if (items.length === 0) return [];
  const results = new Array<R>(items.length);
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

/** Delete OpenAI Files API objects (batch input/output). Ignores already-deleted files. */
export async function deleteOpenAiFiles(file_ids: (string | null | undefined)[]) {
  const unique_ids = [...new Set(file_ids.filter((id): id is string => !!id))];
  await Promise.all(
    unique_ids.map(async (file_id) => {
      try {
        await getOpenAI().files.delete(file_id);
      } catch (err) {
        // OpenAI often expires/removes batch files before we clean up — 404 is expected.
        const status = (err as { status?: number } | null)?.status;
        if (status === 404) return;
        throw err;
      }
    })
  );
}

/** Delete OpenAI input/output files and the ai_batches row (cascade-deletes responses). */
export async function discardAiBatchEntirely(batch_id: string) {
  const batch = await db.query.ai_batches.findFirst({
    columns: { input_file_id: true, output_file_id: true },
    where: eq(ai_batches.batch_id, batch_id)
  });
  if (!batch) return false;

  // Remote files first so a failure keeps the DB row for retry.
  await deleteOpenAiFiles([batch.input_file_id, batch.output_file_id]);
  await db.delete(ai_batches).where(eq(ai_batches.batch_id, batch_id));
  return true;
}

export function scheduleOpenAiBatchCleanup(batch_id: string) {
  const cleanup = (async () => {
    const remaining = await db.query.ai_batch_responses.findFirst({
      columns: { batch_id: true },
      where: eq(ai_batch_responses.batch_id, batch_id)
    });
    if (remaining) return;
    await discardAiBatchEntirely(batch_id);
  })().catch((err) => {
    console.error(`Failed OpenAI batch file cleanup for batch ${batch_id}:`, err);
  });

  waitUntil(cleanup);
}

/** Compact debug payload for metadata.error (not full OpenAI bodies). */
export function batchFailureError(
  reason: string,
  extra?: Record<string, unknown>
): Record<string, unknown> {
  return { reason, ...extra };
}

export function errMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/**
 * Lock and mark a source batch as retrying. The source stays intact until the
 * replacement batch is persisted, so enqueue failures remain recoverable.
 */
export async function claimBatchForRetry<T>(args: {
  batch_id: string;
  batch_type: 'image' | 'object';
  validateAndMap: (
    batch: typeof ai_batches.$inferSelect,
    responses: (typeof ai_batch_responses.$inferSelect)[]
  ) => T | Promise<T>;
}): Promise<{
  mapped: T;
  input_file_id: string;
  output_file_id: string | null;
}> {
  return db.transaction(async (tx) => {
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
}

export async function releaseBatchRetryClaim(batch_id: string) {
  await db.execute(sql`
    UPDATE ${ai_batch_responses}
    SET metadata = metadata - 'retry_claimed_at'
    WHERE batch_id = ${batch_id}
  `);
}

export function isResponseItemProcessed(metadata: BatchMetadata): boolean {
  return metadata.success !== undefined;
}

/** Create OpenAI batch, persist rows, schedule poll — rollback OpenAI+DB on insert failure. */
export async function enqueueAiBatch(args: {
  batch_type: 'image' | 'object';
  batch_requests: AiBatchInput[];
  response_rows: {
    custom_id: string;
    auto_approved: boolean;
    metadata: BatchMetadata;
  }[];
}): Promise<{ batch_id: string; item_count: number }> {
  const { batch_type, batch_requests, response_rows } = args;
  if (batch_requests.length === 0 || response_rows.length === 0) {
    throw new Error('enqueueAiBatch requires at least one request/response row');
  }
  if (batch_requests.length !== response_rows.length) {
    throw new Error('enqueueAiBatch request/response row counts must match');
  }

  const { batch_id, input_file_id } = await createAiBatch(getOpenAI(), batch_requests);
  try {
    await db.transaction(async (tx) => {
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
    await publishAiBatchResultsQueue({ batch_id, poll_attempt: 0 }, BATCH_POLLING_INTERVAL_S);
  } catch (err) {
    await db
      .delete(ai_batch_responses)
      .where(eq(ai_batch_responses.batch_id, batch_id))
      .catch((cleanup_err) => {
        console.error(`Failed to delete orphaned batch responses ${batch_id}:`, cleanup_err);
      });
    await db
      .delete(ai_batches)
      .where(eq(ai_batches.batch_id, batch_id))
      .catch((cleanup_err) => {
        console.error(`Failed to delete orphaned ai_batches row ${batch_id}:`, cleanup_err);
      });
    await getOpenAI()
      .batches.cancel(batch_id)
      .catch((cancel_err) => {
        console.error(`Failed to cancel orphaned OpenAI batch ${batch_id}:`, cancel_err);
      });
    throw err;
  }

  return { batch_id, item_count: response_rows.length };
}

export async function tryClaimBatchRow(batch_id: string, custom_id: string) {
  return db.transaction(async (tx) => {
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
}

export async function updateBatchResponse(
  tx: transactionType,
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
  tx: transactionType,
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
  tx: transactionType,
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
    .set({
      output_resolved: true,
      ...(output_file_id != null ? { output_file_id } : {})
    })
    .where(and(eq(ai_batches.batch_id, batch_id), eq(ai_batches.output_resolved, false)));
}
