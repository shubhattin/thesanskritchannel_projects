/**
 * Framework-neutral env bag helpers for composition roots (SvelteKit / Astro).
 * Services still receive already-resolved strings via AppConfig / SharedConfig —
 * these helpers only build those inputs at the edge.
 */

export type EnvBag = Record<string, string | undefined>;

/** import.meta.env-style source bag: string-indexed primitive entries. */
export type EnvSource = Record<string, string | number | boolean | undefined>;

/** First non-empty string across maps (public / vite bags should be listed before private). */
export const pickEnv =
  (...maps: EnvBag[]) =>
  (key: string): string | undefined => {
    for (const map of maps) {
      const value = map[key];
      if (value !== undefined && value !== '') return value;
    }
    return undefined;
  };

/** Non-empty string guard — import.meta.env mixes strings with boolean flags. */
const isNonEmptyString = (value: string | number | boolean | undefined): value is string =>
  typeof value === 'string' && value !== '';

/** Coerce `import.meta.env` values to a non-empty string. */
export const envString = (value: string | number | boolean | undefined): string | undefined =>
  isNonEmptyString(value) ? value : undefined;

/** Flatten string-ish entries from `import.meta.env` / similar objects into an EnvBag. */
export const envBagFromUnknown = (source: EnvSource) => {
  const out: EnvBag = {};
  for (const [key, value] of Object.entries(source)) {
    const s = envString(value);
    if (s !== undefined) out[key] = s;
  }
  return out;
};

export const parseOptionalBoolean = (value: string | undefined): boolean | undefined => {
  if (value === undefined || value === '') return undefined;
  return value === 'true';
};
