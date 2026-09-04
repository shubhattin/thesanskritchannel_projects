import { get_script_from_id } from '@app/state/lang_list';
import { transliterate_custom } from '@app/tools/converter';
import { DEFAULT_SCRIPT_ID } from '../cookies';

const BASE_SCRIPT = 'Devanagari';

/** Browser transliteration via default lipilekhika (wasm/base). */
export const transliterate_for_display_client = async (
  text: string,
  script_id: number
): Promise<string> => {
  if (script_id === DEFAULT_SCRIPT_ID) return text;
  const to = get_script_from_id(script_id) ?? get_script_from_id(DEFAULT_SCRIPT_ID);
  return transliterate_custom(text, BASE_SCRIPT, to);
};

/** Browser list transliteration via default lipilekhika (wasm/base). */
export const transliterate_list_for_display_client = async (
  text: string[],
  script_id: number
): Promise<string[]> => {
  if (script_id === DEFAULT_SCRIPT_ID) return text;
  const to = get_script_from_id(script_id) ?? get_script_from_id(DEFAULT_SCRIPT_ID);
  return transliterate_custom(text, BASE_SCRIPT, to);
};
