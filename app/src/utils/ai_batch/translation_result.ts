import { z } from 'zod';
import { translation_out_schema } from '~/api/routes/ai/ai_types';

export const batch_translation_object_schema = z.object({
  translations: translation_out_schema.array()
});

export type BatchTranslationObject = z.infer<typeof batch_translation_object_schema>;

/**
 * Validate model output (positional 0..n-1) against source DB indexes and map to DB indexes.
 * Returns null when length/order/duplicates do not match.
 */
export function mapPositionalTranslationsToDbIndexes(
  translations: z.infer<typeof translation_out_schema>[],
  source_indexes: readonly number[]
): z.infer<typeof translation_out_schema>[] | null {
  if (translations.length !== source_indexes.length) return null;
  if (translations.some((translation, i) => translation.index !== i)) return null;

  return translations.map((translation, i) => ({
    text: translation.text,
    index: source_indexes[i]!
  }));
}
