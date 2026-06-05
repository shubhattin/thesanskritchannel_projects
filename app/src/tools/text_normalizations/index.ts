type NormalizationSchema = {
  fn: (text: string) => string;
  description: string;
  /** Lower is higher */
  execution_order: number;
};

const normalizations = {
  replace_colon_with_visarga: {
    execution_order: 1,
    fn: (text: string) => text.replace(/:/g, 'ः'),
    description: 'Replace colon with visarga "ः"'
  },
  remove_extra_spaces_and_collapse_single: {
    execution_order: 2,
    fn: (text: string) => text.replace(/[ \t]+/g, ' ').trim(),
    description: 'Remove extra spaces'
  },
  replace_double_bar_with_purna_virama: {
    execution_order: 3,
    fn: (text: string) => text.replace(/\|\|/g, '॥'),
    description: 'Replace || with ॥'
  },
  remove_space_when_number_between_double_virama: {
    execution_order: 4,
    fn: (text: string) => text.replace(/॥\s*([०-९]+)\s*॥/g, '॥$1॥'),
    description: 'Remove space when number between double virama'
  },
  replace_single_bar_with_virama: {
    execution_order: 5,
    fn: (text: string) => text.replace(/\|/g, '।'),
    description: 'Replace | with ।'
  }
} satisfies Record<string, NormalizationSchema>;

export type NormalizationKey = keyof typeof normalizations;

export const DEFAULT_ENABLED_NORMALIZATIONS = [
  'replace_colon_with_visarga',
  'remove_extra_spaces_and_collapse_single',
  'replace_double_bar_with_purna_virama'
] satisfies NormalizationKey[];

const sort_normalization_keys = (keys: readonly NormalizationKey[]) =>
  [...keys].sort(
    (a, b) =>
      normalizations[a].execution_order - normalizations[b].execution_order || a.localeCompare(b)
  );

export const get_normalization_options = () =>
  sort_normalization_keys(Object.keys(normalizations) as NormalizationKey[]).map((key) => ({
    key,
    description: normalizations[key].description
  }));

export const apply_normalizations_to_texts = (
  texts: readonly string[],
  textIndices: readonly number[],
  enabledKeys: readonly NormalizationKey[]
): string[] => {
  const keys = sort_normalization_keys(enabledKeys);
  if (keys.length === 0) return [...texts];

  const result = [...texts];
  for (const index of textIndices) {
    if (index < 0 || index >= result.length) continue;
    let text = result[index]!;
    for (const key of keys) {
      text = normalizations[key].fn(text);
    }
    result[index] = text;
  }
  return result;
};

export const apply_single_normalization_to_texts = (
  texts: readonly string[],
  textIndices: readonly number[],
  key: NormalizationKey
) => apply_normalizations_to_texts(texts, textIndices, [key]);
