import { transliterate_custom } from '@app/tools/converter';
import { DEFAULT_SCRIPT_ID } from '../cookies';
import { transliterate_node } from 'lipilekhika/node';
import { get_display_script_from_id } from './display-script';

export { get_display_script_from_id } from './display-script';

const BASE_SCRIPT = 'Devanagari';

/** Node/Bun only — uses lipilekhika/node. */
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
    transliterate_node
  );
};

/** Node/Bun only — uses lipilekhika/node. */
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
    transliterate_node
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
