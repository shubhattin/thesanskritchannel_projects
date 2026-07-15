/** Pure validation for "retry failed batch" — no DB / OpenAI side effects. */

export type RetrySourceRow = {
  custom_id: string;
  auto_approved: boolean;
  metadata: { success?: boolean; retry_claimed_at?: string };
};

export type RetryBatchGateResult =
  | { ok: true }
  | { ok: false; code: 'NOT_FOUND' | 'BAD_REQUEST' | 'CONFLICT'; message: string };

/**
 * Retry is only allowed when the batch is fully resolved and every remaining
 * staging row failed (successful auto-approved rows are already deleted).
 */
export function validateFullyFailedBatchForRetry(args: {
  batch: { output_resolved: boolean; responses: RetrySourceRow[] } | null | undefined;
}): RetryBatchGateResult {
  const { batch } = args;
  if (!batch) {
    return { ok: false, code: 'NOT_FOUND', message: 'Batch not found' };
  }
  if (batch.responses.some((row) => row.metadata.retry_claimed_at)) {
    return {
      ok: false,
      code: 'CONFLICT',
      message: 'A retry for this batch is already in progress'
    };
  }
  if (!batch.output_resolved) {
    return {
      ok: false,
      code: 'BAD_REQUEST',
      message: 'Batch is still processing; wait until it finishes before retrying'
    };
  }
  if (batch.responses.length === 0) {
    return {
      ok: false,
      code: 'BAD_REQUEST',
      message: 'Batch has no remaining items to retry'
    };
  }
  const not_failed = batch.responses.filter((row) => row.metadata.success !== false);
  if (not_failed.length > 0) {
    return {
      ok: false,
      code: 'BAD_REQUEST',
      message:
        'Retry is only available when every remaining item failed (no pending or ready items)'
    };
  }
  return { ok: true };
}

/** Strip completion / error fields so a retry row starts pending. */
export function freshImageRetryMetadata(metadata: {
  project_id: number;
  project_path_id: number;
  path_params: number[];
  index: number | null;
  image_prompt: string;
}) {
  return {
    type: 'shloka-image' as const,
    project_id: metadata.project_id,
    project_path_id: metadata.project_path_id,
    path_params: metadata.path_params,
    index: metadata.index,
    image_prompt: metadata.image_prompt
  };
}

export function freshTextRetryMetadata(args: {
  project_id: number;
  project_path_id: number;
  path_params: number[];
  lang_id: number;
  include_english_context: boolean;
  source_indexes: number[];
}) {
  return {
    type: 'text-translation' as const,
    project_id: args.project_id,
    project_path_id: args.project_path_id,
    path_params: args.path_params,
    lang_id: args.lang_id,
    include_english_context: args.include_english_context,
    source_indexes: args.source_indexes
  };
}
