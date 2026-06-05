import { REDIS_CACHE_KEYS_CLIENT } from '~/db/redis_shared';
import type { recursive_list_type } from '~/state/data_types';
import { remove_vedic_svara_chihnAni } from '~/utils/normalize_text';

/** Serializes text row saves and translation edits for the same project. */
export const TEXT_EDIT_LOCK_NAMESPACE = 42801;

export type TextEditorRowInput = {
  source_index: number | null;
  text: string;
  shloka_type: boolean;
};

export type TextRowForDb = {
  index: number;
  shloka_num: number | null;
  text: string;
  text_search: string;
};

export type ExistingTranslationRow = {
  lang_id: number;
  index: number;
  text: string;
};

export type TranslationRowForDb = ExistingTranslationRow;

export const buildTextRowsForSave = (rows: readonly TextEditorRowInput[]): TextRowForDb[] => {
  let shloka_num = 0;
  return rows.map((row, index) => {
    const is_shloka = row.shloka_type;
    if (is_shloka) shloka_num++;
    return {
      index,
      shloka_num: is_shloka ? shloka_num : null,
      text: row.text,
      text_search: remove_vedic_svara_chihnAni(row.text)
    };
  });
};

export const buildOldToNewTextIndexMap = (rows: readonly TextEditorRowInput[]) => {
  const old_to_new = new Map<number, number>();
  for (let new_index = 0; new_index < rows.length; new_index++) {
    const old_index = rows[new_index]?.source_index;
    if (old_index === null || old_index === undefined) continue;
    if (old_to_new.has(old_index)) {
      throw new Error(`Duplicate source index in text edit payload: ${old_index}`);
    }
    old_to_new.set(old_index, new_index);
  }
  return old_to_new;
};

export const remapTranslationsForTextRows = (
  rows: readonly TextEditorRowInput[],
  translations: readonly ExistingTranslationRow[]
): TranslationRowForDb[] => {
  const old_to_new = buildOldToNewTextIndexMap(rows);
  const remapped: TranslationRowForDb[] = [];

  for (const translation of translations) {
    const new_index = old_to_new.get(translation.index);
    if (new_index === undefined) continue;
    remapped.push({
      lang_id: translation.lang_id,
      index: new_index,
      text: translation.text
    });
  }

  return remapped.sort((a, b) => a.lang_id - b.lang_id || a.index - b.index);
};

export const buildTextEditRedisKeys = (
  project_id: number,
  path_params: readonly number[],
  affected_lang_ids: Iterable<number>
) => {
  const keys = new Set<string>();
  keys.add(REDIS_CACHE_KEYS_CLIENT.text_data(project_id, [...path_params]));
  for (const lang_id of affected_lang_ids) {
    keys.add(REDIS_CACHE_KEYS_CLIENT.translation(project_id, lang_id, [...path_params]));
  }
  keys.add(REDIS_CACHE_KEYS_CLIENT.project_map(project_id));
  return [...keys];
};

export const getAffectedTranslationLangIds = (
  translations: readonly Pick<ExistingTranslationRow, 'lang_id'>[]
) => [...new Set(translations.map((row) => row.lang_id))];

export const cloneMapWithUpdatedLeafCounts = (
  map: recursive_list_type,
  path_params: readonly number[],
  counts: { total: number; shloka_count: number }
): recursive_list_type => {
  const cloned = structuredClone(map);
  let node = cloned;
  for (const path_part of path_params) {
    if (node.info.type !== 'list') {
      throw new Error('Selected path does not point to a shloka leaf');
    }
    const child = node.list?.[path_part - 1];
    if (!child) throw new Error(`Invalid path segment: ${path_part}`);
    node = child;
  }
  if (node.info.type !== 'shloka') {
    throw new Error('Selected path does not point to a shloka leaf');
  }
  node.info.total = counts.total;
  node.info.shloka_count = counts.shloka_count;
  return cloned;
};
