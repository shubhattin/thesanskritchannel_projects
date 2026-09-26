import { transliterate_list_for_display_client } from '$lib/main_text/script-display-client';

const cache = new Map<string, string>();

const key_of = (script_id: number, text: string) => `${script_id}\0${text}`;

/**
 * Devanagari names → the viewing script, cached across script toggles.
 * One list transliteration per script for the names that are not cached yet.
 */
export const load_display_names = async (
  names: readonly string[],
  script_id: number
): Promise<ReadonlyMap<string, string>> => {
  const unique = [...new Set(names.filter((name) => name.length > 0))];
  const missing = unique.filter((name) => !cache.has(key_of(script_id, name)));
  if (missing.length > 0) {
    const translated = await transliterate_list_for_display_client(missing, script_id);
    for (let i = 0; i < missing.length; i++) {
      const name = missing[i]!;
      cache.set(key_of(script_id, name), translated[i] ?? name);
    }
  }

  const out = new Map<string, string>();
  for (const name of unique) {
    const value = cache.get(key_of(script_id, name));
    if (value !== undefined) out.set(name, value);
  }
  return out;
};
