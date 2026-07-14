import { describe, expect, test } from 'vitest';
import { z } from 'zod';
import { toAiBatchLine } from '~/utils/ai_batch';
import {
  batch_translation_object_schema,
  mapPositionalTranslationsToDbIndexes
} from '~/utils/ai_batch/translation_result';
import {
  getTextTranslationBatchCustomId,
  parseTextTranslationBatchCustomId
} from '~/utils/ai_batch/text-translation';
import { deriveTranslationBatchUiStatus } from '~/utils/ai_batch/batch_translation_status';

describe('mapPositionalTranslationsToDbIndexes', () => {
  test('maps positional indexes to DB indexes', () => {
    const mapped = mapPositionalTranslationsToDbIndexes(
      [
        { index: 0, text: 'a' },
        { index: 1, text: 'b' },
        { index: 2, text: 'c' }
      ],
      [10, 11, 14]
    );
    expect(mapped).toEqual([
      { index: 10, text: 'a' },
      { index: 11, text: 'b' },
      { index: 14, text: 'c' }
    ]);
  });

  test('rejects length mismatch', () => {
    expect(mapPositionalTranslationsToDbIndexes([{ index: 0, text: 'a' }], [1, 2])).toBeNull();
  });

  test('rejects non-positional order', () => {
    expect(
      mapPositionalTranslationsToDbIndexes(
        [
          { index: 0, text: 'a' },
          { index: 2, text: 'b' }
        ],
        [1, 2]
      )
    ).toBeNull();
  });
});

describe('batch translation object schema + serialization', () => {
  test('parses object output', () => {
    const parsed = batch_translation_object_schema.parse({
      translations: [
        { index: 0, text: 'Hello' },
        { index: 1, text: 'World' }
      ]
    });
    expect(parsed.translations).toHaveLength(2);
  });

  test('toAiBatchLine builds json_schema for object type', () => {
    const line = toAiBatchLine({
      type: 'object',
      custom_id: 'text-translation:1-2/3-1-Ab12',
      model: 'gpt-5.2',
      instructions: 'system',
      input: 'user prompt',
      output_schema: batch_translation_object_schema,
      output_schema_name: 'translations_text_schema',
      reasoning: { effort: 'low' }
    });
    expect(line.url).toBe('/v1/responses');
    expect(line.body.model).toBe('gpt-5.2');
    expect(line.body.text).toEqual({
      format: {
        type: 'json_schema',
        name: 'translations_text_schema',
        schema: z.toJSONSchema(batch_translation_object_schema),
        strict: true
      }
    });
  });
});

describe('text translation custom id', () => {
  test('round-trips path and lang', () => {
    const custom_id = getTextTranslationBatchCustomId(7, [2, 5], 3);
    const parsed = parseTextTranslationBatchCustomId(custom_id);
    expect(parsed).not.toBeNull();
    expect(parsed!.project_id).toBe(7);
    expect(parsed!.path_params).toEqual([2, 5]);
    expect(parsed!.lang_id).toBe(3);
  });
});

describe('deriveTranslationBatchUiStatus', () => {
  test('processing when unresolved', () => {
    expect(
      deriveTranslationBatchUiStatus(
        false,
        {
          type: 'text-translation',
          project_id: 1,
          project_path_id: 1,
          path_params: [1],
          lang_id: 1,
          include_english_context: false,
          source_indexes: [0]
        },
        true
      )
    ).toBe('processing');
  });

  test('ready_for_review when successful and manual', () => {
    expect(
      deriveTranslationBatchUiStatus(
        true,
        {
          type: 'text-translation',
          project_id: 1,
          project_path_id: 1,
          path_params: [1],
          lang_id: 1,
          include_english_context: false,
          source_indexes: [0],
          success: true,
          translated_data: [{ index: 0, text: 'x' }]
        },
        false
      )
    ).toBe('ready_for_review');
  });

  test('failed when success false', () => {
    expect(
      deriveTranslationBatchUiStatus(
        true,
        {
          type: 'text-translation',
          project_id: 1,
          project_path_id: 1,
          path_params: [1],
          lang_id: 1,
          include_english_context: false,
          source_indexes: [0],
          success: false
        },
        false
      )
    ).toBe('failed');
  });
});
