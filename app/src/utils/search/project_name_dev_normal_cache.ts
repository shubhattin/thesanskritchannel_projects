import { preloadScriptData, type ScriptLangType } from 'lipilekhika';
import type { script_list_type } from '../../state/lang_list';
import { transliterate_custom } from '../../tools/converter';

const NORMAL_SCRIPT = 'Normal' as const;

const cache = new Map<string, string>();
const pending = new Map<string, Promise<string>>();
const ready_by_script = new Map<string, Promise<void>>();

const cache_key = (from: string, text: string) => `${from}\0${text}`;

const ensure_scripts_ready = (from: ScriptLangType): Promise<void> => {
  const existing = ready_by_script.get(from);
  if (existing) return existing;
  const promise = Promise.all([preloadScriptData(from), preloadScriptData(NORMAL_SCRIPT)]).then(
    () => undefined
  );
  ready_by_script.set(from, promise);
  return promise;
};

/** Sync read of a finished from-script → Normal transliteration. */
export const cached_text_normal = (
  from: script_list_type,
  text: string
): string | undefined => cache.get(cache_key(from, text));

/** Shared from-script → Normal cache. Document names and query words reuse the same entries. */
export const ensure_text_normal = (from: script_list_type, text: string): Promise<string> => {
  if (!text) return Promise.resolve('');
  const key = cache_key(from, text);
  const cached = cache.get(key);
  if (cached !== undefined) return Promise.resolve(cached);

  const in_flight = pending.get(key);
  if (in_flight) return in_flight;

  const promise = (async () => {
    await ensure_scripts_ready(from);
    const value = await transliterate_custom(text, from, NORMAL_SCRIPT);
    cache.set(key, value);
    pending.delete(key);
    return value;
  })();

  pending.set(key, promise);
  return promise;
};

export type ProjectNameDevNormalCache = {
  get: (name_dev: string) => string | undefined;
  ensure: (name_dev: string) => Promise<string>;
  ensure_all: (name_devs: readonly string[]) => Promise<void>;
};

/** Per-caller view of the shared Devanagari → Normal cache used for list search. */
export const create_project_name_dev_normal_cache = (): ProjectNameDevNormalCache => {
  return {
    get: (name_dev) => cached_text_normal('Devanagari', name_dev),
    ensure: (name_dev) => ensure_text_normal('Devanagari', name_dev),
    ensure_all: async (name_devs) => {
      const unique = [...new Set(name_devs.filter(Boolean))];
      await Promise.all(unique.map((name_dev) => ensure_text_normal('Devanagari', name_dev)));
    }
  };
};
