import { preloadScriptData } from 'lipilekhika';
import { transliterate_custom } from '../../tools/converter';

const BASE_SCRIPT = 'Devanagari' as const;
const NORMAL_SCRIPT = 'Normal' as const;

let transliteration_ready: Promise<void> | null = null;

const ensure_transliteration_ready = (): Promise<void> => {
  if (!transliteration_ready) {
    transliteration_ready = Promise.all([
      preloadScriptData(BASE_SCRIPT),
      preloadScriptData(NORMAL_SCRIPT)
    ]).then(() => undefined);
  }
  return transliteration_ready;
};

export type ProjectNameDevNormalCache = {
  get: (name_dev: string) => string | undefined;
  ensure: (name_dev: string) => Promise<string>;
  ensure_all: (name_devs: readonly string[]) => Promise<void>;
};

/** Per-component cache of Devanagari name_dev → Normal transliteration for search. */
export const create_project_name_dev_normal_cache = (): ProjectNameDevNormalCache => {
  const cache = new Map<string, string>();
  const pending = new Map<string, Promise<string>>();

  const ensure = async (name_dev: string): Promise<string> => {
    if (!name_dev) return '';
    const cached = cache.get(name_dev);
    if (cached !== undefined) return cached;

    const in_flight = pending.get(name_dev);
    if (in_flight) return in_flight;

    const promise = (async () => {
      await ensure_transliteration_ready();
      const normal = await transliterate_custom(name_dev, BASE_SCRIPT, NORMAL_SCRIPT);
      const value = typeof normal === 'string' ? normal : '';
      cache.set(name_dev, value);
      pending.delete(name_dev);
      return value;
    })();

    pending.set(name_dev, promise);
    return promise;
  };

  return {
    get: (name_dev) => cache.get(name_dev),
    ensure,
    ensure_all: async (name_devs) => {
      const unique = [...new Set(name_devs.filter(Boolean))];
      await Promise.all(unique.map(ensure));
    }
  };
};
