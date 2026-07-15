import { z } from 'zod';
import ms from 'ms';
import { translation_out_schema } from '~/api/routes/ai/ai_types';

/*
# Image Workflow
- We poll on specific intervals and upload to the bucket
- Store its reference in the metadata and then use it later
*/

/** Polling Interval for Batch API via QStash */
export const BATCH_POLLING_INTERVAL_S = ms('5mins') / 1000;

/** OpenAI batch completion window is 24h; stop QStash retries after that. */
export const MAX_BATCH_POLL_ATTEMPTS = Math.ceil((24 * 60 * 60) / BATCH_POLLING_INTERVAL_S);

export const image_batch_metadata_schema = z.object({
  type: z.literal('shloka-image'),
  project_id: z.number().int(),
  /** Stable ownership key across path renames */
  project_path_id: z.number().int(),
  /** Snapshot used for S3 naming / UI labels (higher→lower path segments) */
  path_params: z.number().int().array(),
  /**
   * Text row index within the project path.
   * Null when the source row was deleted/orphaned after a text reorder.
   */
  index: z.number().int().nullable(),
  image_prompt: z.string(),
  /** to be edited upon batch completion */
  success: z.boolean().optional(),
  /** image_assets id (upload after successful batch completion) */
  uploaded_image_id: z.number().int().optional(),
  /** Optional error dump (would be useful for later debugging) */
  error: z.any().optional(),
  /** set while a poll worker is processing this row */
  poll_claimed_at: z.string().optional(),
  /** set while a retry request owns this completed failed row */
  retry_claimed_at: z.string().optional()
});

export const text_translation_batch_metadata_schema = z.object({
  type: z.literal('text-translation'),
  project_id: z.number().int(),
  /** Stable ownership key across path renames */
  project_path_id: z.number().int(),
  /** Snapshot used for UI labels (higher→lower path segments) */
  path_params: z.number().int().array(),
  /** Target translation language */
  lang_id: z.number().int(),
  /** Whether English translations were included as prompt context */
  include_english_context: z.boolean(),
  /**
   * Ordered DB text indexes captured at enqueue time.
   * Model output uses positional 0..n-1; we map back through this list.
   */
  source_indexes: z.number().int().array(),
  /** to be edited upon batch completion */
  success: z.boolean().optional(),
  /** error dump */
  error: z.any().optional(),
  /** translated data with DB indexes (after successful batch completion) */
  translated_data: translation_out_schema.array().optional(),
  /** set while a poll worker is processing this row */
  poll_claimed_at: z.string().optional(),
  /** set while a retry request owns this completed failed row */
  retry_claimed_at: z.string().optional()
});

export const batch_metadata_schema = z.discriminatedUnion('type', [
  image_batch_metadata_schema,
  text_translation_batch_metadata_schema
]);
export type BatchMetadata = z.infer<typeof batch_metadata_schema>;
export type ImageBatchMetadata = z.infer<typeof image_batch_metadata_schema>;
export type TextTranslationBatchMetadata = z.infer<typeof text_translation_batch_metadata_schema>;
