import type { BatchMetadata } from '~/utils/types/ai_batch_metadata';

export type ImageBatchUiStatus = 'processing' | 'ready_for_review' | 'auto_applying' | 'failed';

export const IMAGE_BATCH_STATUS_LABELS: Record<ImageBatchUiStatus, string> = {
  processing: 'Processing',
  ready_for_review: 'Ready for review',
  auto_applying: 'Auto-applying',
  failed: 'Failed'
};

export const IMAGE_BATCH_STATUS_VARIANTS: Record<
  ImageBatchUiStatus,
  'secondary' | 'default' | 'destructive'
> = {
  processing: 'secondary',
  ready_for_review: 'default',
  auto_applying: 'default',
  failed: 'destructive'
};

export function deriveImageBatchUiStatus(
  output_resolved: boolean,
  metadata: BatchMetadata,
  auto_approved: boolean
): ImageBatchUiStatus {
  if (!output_resolved) {
    return 'processing';
  }
  if (metadata.success === true && metadata.uploaded_image_id !== undefined) {
    if (auto_approved) {
      return 'auto_applying';
    }
    return 'ready_for_review';
  }
  return 'failed';
}
