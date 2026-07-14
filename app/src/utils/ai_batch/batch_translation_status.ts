import type { TextTranslationBatchMetadata } from '~/utils/types/ai_batch_metadata';

export type TranslationBatchUiStatus =
  | 'processing'
  | 'ready_for_review'
  | 'auto_applying'
  | 'failed';

export const TRANSLATION_BATCH_STATUS_LABELS: Record<TranslationBatchUiStatus, string> = {
  processing: 'Processing',
  ready_for_review: 'Ready for review',
  auto_applying: 'Auto-applying',
  failed: 'Failed'
};

export const TRANSLATION_BATCH_STATUS_VARIANTS: Record<
  TranslationBatchUiStatus,
  'secondary' | 'default' | 'destructive'
> = {
  processing: 'secondary',
  ready_for_review: 'default',
  auto_applying: 'default',
  failed: 'destructive'
};

export function deriveTranslationBatchUiStatus(
  output_resolved: boolean,
  metadata: TextTranslationBatchMetadata,
  auto_approved: boolean
): TranslationBatchUiStatus {
  if (!output_resolved) {
    return 'processing';
  }
  if (metadata.success === true && metadata.translated_data !== undefined) {
    if (auto_approved) {
      return 'auto_applying';
    }
    return 'ready_for_review';
  }
  return 'failed';
}
