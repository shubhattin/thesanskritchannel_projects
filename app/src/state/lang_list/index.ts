// ALWAYS BE CAREFUL BEFORE CHANGING LANG JSON
// AS CHNAGE IN PRE-EXISTING LANG IDS WOULD CAUSE DATA MISMATCHs

// NOTE : from now on the script_list part is depricated and will be removed
// it can be replaced with the `lipilekhika` exported SCRIPT_LIST
import langs from './langs.json';
const { script_list, lang_list } = langs;

export const SCRIPT_LIST = Object.keys(script_list);
export type script_list_type = keyof typeof script_list;
export const SCRIPT_LIST_IDS = Object.values(script_list);

export const get_script_from_id = (id: number) => {
  // SAFETY: SCRIPT_LIST is Object.keys(script_list) and SCRIPT_LIST_IDS the parallel Object.values, so the element at indexOf(id) is the matching script_list_type key (undefined if the id is unknown, as before).
  return SCRIPT_LIST[SCRIPT_LIST_IDS.indexOf(id)] as script_list_type;
};

export const get_script_id = (script: script_list_type) => {
  return script_list[script] ?? null;
};

export const LANG_LIST = Object.keys(lang_list);
export const LANG_LIST_IDS = Object.values(lang_list);
export type lang_list_type = keyof typeof lang_list;
// the langs enum in schema.ts has to be updated manually

export const get_lang_from_id = (id: number) => {
  // SAFETY: LANG_LIST is Object.keys(lang_list) and LANG_LIST_IDS the parallel Object.values, so the element at indexOf(id) is the matching lang_list_type key (undefined if the id is unknown, as before).
  return LANG_LIST[LANG_LIST_IDS.indexOf(id)] as lang_list_type;
};

export const get_translation_slot_label = (slot: 0 | 1, lang_ids: readonly (number | null)[]) => {
  const lang_id = lang_ids[slot] ?? null;
  return lang_id === null ? `Lang ${slot + 1}` : get_lang_from_id(lang_id);
};

export const ALL_LANG_SCRIPT_LIST = Array.from(new Set([...LANG_LIST, ...SCRIPT_LIST])).filter(
  (src) => !['Normal'].includes(src)
);

export type script_and_lang_list_type = script_list_type | lang_list_type;
export { lang_list as lang_list_obj, script_list as script_list_obj };

/** Named owner contract (kept structurally identical to `Record<lang_list_type, script_list_type>`). */
export interface lang_script_map_type {
  Bengali: script_list_type;
  Gujarati: script_list_type;
  Hindi: script_list_type;
  Kannada: script_list_type;
  Malayalam: script_list_type;
  Odia: script_list_type;
  Sinhala: script_list_type;
  Tamil: script_list_type;
  Telugu: script_list_type;
  English: script_list_type;
  Sanskrit: script_list_type;
  Marathi: script_list_type;
  Nepali: script_list_type;
  Punjabi: script_list_type;
}

export const LANG_SCRIPT_MAP: lang_script_map_type = {
  Bengali: 'Bengali',
  Gujarati: 'Gujarati',
  Hindi: 'Devanagari',
  Kannada: 'Kannada',
  Malayalam: 'Malayalam',
  Odia: 'Odia',
  Sinhala: 'Sinhala',
  Tamil: 'Tamil',
  Telugu: 'Telugu',
  English: 'Normal',
  Sanskrit: 'Devanagari',
  Marathi: 'Devanagari',
  Nepali: 'Devanagari',
  Punjabi: 'Gurumukhi'
};

export const get_script_for_lang = (lang: lang_list_type) => {
  if (lang === 'English') return null;
  return LANG_SCRIPT_MAP[lang] ?? null;
};

export const get_script_for_lang_id = (id: number) => {
  const index = LANG_LIST_IDS.indexOf(id);
  if (index === -1) return null;
  // SAFETY: index !== -1 here and LANG_LIST is Object.keys(lang_list), so LANG_LIST[index] is a lang_list_type key.
  const lang = LANG_LIST[index] as lang_list_type;
  return get_script_for_lang(lang);
};
