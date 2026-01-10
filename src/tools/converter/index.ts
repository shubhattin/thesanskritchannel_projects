import { transliterate, type ScriptLangType, type TransliterationOptions } from 'lipilekhika';

/**
 * Custom Options used for Transliteration in this project
 */
export const CUSTOM_TRANS_OPTIONS = {
  'all_to_normal:remove_virAma_and_double_virAma': true,
  'all_to_normal:replace_avagraha_with_a': true,
  'all_to_normal:replace_pancham_varga_varna_with_n': true,
  'all_to_sinhala:use_conjunct_enabling_halant': true
} as TransliterationOptions;

/**
 * Scripts in which option `brahmic_to_brahmic:replace_pancham_varga_varna_with_anusvAra`
 * is to be enabled
 */
export const SCRIPTS_TO_REPLACE_WITH_ANUNASIK = ['Telugu', 'Kannada'];

/**
 * Custom `transliterate` function which applies the `CUSTOM_TRANS_OPTIONS`
 */
export async function transliterate_custom<T extends string | string[]>(
  text: T,
  from: ScriptLangType,
  to: ScriptLangType,
  trans_options?: TransliterationOptions
): Promise<T extends string ? string : string[]> {
  trans_options = {
    ...trans_options,
    ...CUSTOM_TRANS_OPTIONS
  };
  if (SCRIPTS_TO_REPLACE_WITH_ANUNASIK.indexOf(to) !== -1) {
    trans_options = {
      ...trans_options,
      'brahmic_to_brahmic:replace_pancham_varga_varna_with_anusvAra': true
    };
  }
  if (typeof text === 'string') {
    return (await transliterate(text, from, to, trans_options)) as any;
  }
  const results = await Promise.all(
    (text as string[]).map((v) => transliterate(v, from, to, trans_options))
  );
  return results as any;
}
