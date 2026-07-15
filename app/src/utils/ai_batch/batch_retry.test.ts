import { describe, expect, test } from 'vitest';
import {
  freshImageRetryMetadata,
  freshTextRetryMetadata,
  validateFullyFailedBatchForRetry
} from '~/utils/ai_batch/batch_retry';

describe('validateFullyFailedBatchForRetry', () => {
  test('rejects missing batch', () => {
    expect(validateFullyFailedBatchForRetry({ batch: null })).toEqual({
      ok: false,
      code: 'NOT_FOUND',
      message: 'Batch not found'
    });
  });

  test('rejects unresolved batch', () => {
    const result = validateFullyFailedBatchForRetry({
      batch: {
        output_resolved: false,
        responses: [{ custom_id: 'a', auto_approved: true, metadata: { success: false } }]
      }
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('BAD_REQUEST');
  });

  test('rejects empty responses', () => {
    const result = validateFullyFailedBatchForRetry({
      batch: { output_resolved: true, responses: [] }
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.code).toBe('BAD_REQUEST');
  });

  test('rejects mix of failed and ready/pending rows', () => {
    const result = validateFullyFailedBatchForRetry({
      batch: {
        output_resolved: true,
        responses: [
          { custom_id: 'a', auto_approved: false, metadata: { success: false } },
          { custom_id: 'b', auto_approved: false, metadata: { success: true } }
        ]
      }
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe('BAD_REQUEST');
      expect(result.message).toMatch(/every remaining item failed/i);
    }
  });

  test('rejects rows still missing success flag', () => {
    const result = validateFullyFailedBatchForRetry({
      batch: {
        output_resolved: true,
        responses: [{ custom_id: 'a', auto_approved: true, metadata: {} }]
      }
    });
    expect(result.ok).toBe(false);
  });

  test('accepts fully failed resolved batch', () => {
    expect(
      validateFullyFailedBatchForRetry({
        batch: {
          output_resolved: true,
          responses: [
            { custom_id: 'a', auto_approved: true, metadata: { success: false } },
            { custom_id: 'b', auto_approved: false, metadata: { success: false } }
          ]
        }
      })
    ).toEqual({ ok: true });
  });
});

describe('fresh retry metadata', () => {
  test('image metadata drops success/error/upload/claim fields', () => {
    const fresh = freshImageRetryMetadata({
      project_id: 1,
      project_path_id: 2,
      path_params: [3],
      index: 4,
      image_prompt: 'draw this'
    });

    expect(fresh).toEqual({
      type: 'shloka-image',
      project_id: 1,
      project_path_id: 2,
      path_params: [3],
      index: 4,
      image_prompt: 'draw this'
    });
    expect(fresh).not.toHaveProperty('success');
    expect(fresh).not.toHaveProperty('error');
    expect(fresh).not.toHaveProperty('uploaded_image_id');
    expect(fresh).not.toHaveProperty('poll_claimed_at');
  });

  test('text metadata is rebuilt without prior failure fields', () => {
    const fresh = freshTextRetryMetadata({
      project_id: 1,
      project_path_id: 2,
      path_params: [10],
      lang_id: 3,
      include_english_context: true,
      source_indexes: [0, 1, 2]
    });
    expect(fresh).toEqual({
      type: 'text-translation',
      project_id: 1,
      project_path_id: 2,
      path_params: [10],
      lang_id: 3,
      include_english_context: true,
      source_indexes: [0, 1, 2]
    });
    expect(fresh).not.toHaveProperty('success');
    expect(fresh).not.toHaveProperty('error');
    expect(fresh).not.toHaveProperty('translated_data');
  });
});
