import { get_script_from_id } from '../../../../app/src/state/lang_list';
import { transliterate_custom } from '../../../../app/src/tools/converter';
import { DEFAULT_SCRIPT_ID } from '../cookies';

const BASE_SCRIPT = 'Devanagari';

export const get_display_script_from_id = (script_id: number) => {
  return get_script_from_id(script_id) ?? get_script_from_id(DEFAULT_SCRIPT_ID);
};

export const transliterate_for_display = async (
  text: string,
  script_id: number
): Promise<string> => {
  if (script_id === DEFAULT_SCRIPT_ID) return text;
  return transliterate_custom(text, BASE_SCRIPT, get_display_script_from_id(script_id));
};

export const transliterate_list_for_display = async (
  text: string[],
  script_id: number
): Promise<string[]> => {
  if (script_id === DEFAULT_SCRIPT_ID) return text;
  return transliterate_custom(text, BASE_SCRIPT, get_display_script_from_id(script_id));
};
