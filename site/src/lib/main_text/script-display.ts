import { get_script_from_id } from '$app/state/lang_list';
import { transliterate_custom } from '$app/tools/converter';
import { DEFAULT_SCRIPT_ID } from '../cookies';
import { transliterate } from 'lipilekhika';

const BASE_SCRIPT = 'Devanagari';

export const get_display_script_from_id = (script_id: number) => {
  return get_script_from_id(script_id) ?? get_script_from_id(DEFAULT_SCRIPT_ID);
};

/** Server-side display transliteration. Uses lipilekhika WASM (Workers-safe). */
export const transliterate_for_display = async (
  text: string,
  script_id: number
): Promise<string> => {
  if (script_id === DEFAULT_SCRIPT_ID) return text;
  return transliterate_custom(
    text,
    BASE_SCRIPT,
    get_display_script_from_id(script_id),
    undefined,
    transliterate
  );
};

/** Server-side display transliteration for lists. Uses lipilekhika WASM (Workers-safe). */
export const transliterate_list_for_display = async (
  text: string[],
  script_id: number
): Promise<string[]> => {
  if (script_id === DEFAULT_SCRIPT_ID) return text;
  return transliterate_custom(
    text,
    BASE_SCRIPT,
    get_display_script_from_id(script_id),
    undefined,
    transliterate
  );
};
