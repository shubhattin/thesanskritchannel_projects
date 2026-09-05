import { transliterate_custom } from '@app/tools/converter';
import { DEFAULT_SCRIPT_ID } from '../cookies';
import { transliterate } from 'lipilekhika';
import { get_display_script_from_id } from './display-script';

export { get_display_script_from_id } from './display-script';

const BASE_SCRIPT = 'Devanagari';

/** Workers-safe — uses lipilekhika raw (pure JS, no WASM / native binding). */
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

/** Workers-safe — uses lipilekhika raw (pure JS, no WASM / native binding). */
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

/**
 * SSR helper: when script is Devanagari, return null so the client uses base text
 * without duplicating the payload.
 */
export const maybe_transliterate_list = async (
  text: string[],
  script_id: number
): Promise<string[] | null> => {
  if (script_id === DEFAULT_SCRIPT_ID || text.length === 0) return null;
  return transliterate_list_for_display(text, script_id);
};
