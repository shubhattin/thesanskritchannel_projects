// ALWAYS BE CAREFUL BEFORE CHANGING LANG JSON
// AS CHNAGE IN PRE-EXISTING LANG IDS WOULD CAUSE DATA MISMATCHs

import { script_list, lang_list } from './langs.json';

export const SCRIPT_LIST = Object.keys(script_list);
export type script_list_type = keyof typeof script_list;
export const SCRIPT_LIST_IDS = Object.values(script_list);

export const get_script_from_id = (id: number) => {
  return SCRIPT_LIST[SCRIPT_LIST_IDS.indexOf(id)];
};

export const LANG_LIST = Object.keys(lang_list);
export const LANG_LIST_IDS = Object.values(lang_list);
export type lang_list_type = keyof typeof lang_list;
// the langs enum in schema.ts has to be updated manually

export const get_lang_from_id = (id: number) => {
  return LANG_LIST[LANG_LIST_IDS.indexOf(id)];
};

export const ALL_LANG_SCRIPT_LIST = Array.from(new Set([...LANG_LIST, ...SCRIPT_LIST])).filter(
  (src) => !['Normal'].includes(src)
);

export type script_and_lang_list_type = script_list_type | lang_list_type;
export { lang_list as lang_list_obj, script_list as script_list_obj };
