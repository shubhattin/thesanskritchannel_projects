const DEVANAGARI_RE = /[\u0900-\u097F]/;

/** Indicators used when content auto-transliteration is off (per-`<lipi>` mode). */
const LIPI_INDICATORS = ['<lipi>', '<lipi-shloka>'] as const;

export function contains_devanagari(text: string) {
  return DEVANAGARI_RE.test(text);
}

/**
 * Whether the lekha page should offer a script selector.
 * Title and description count only when their auto-transliterate flag is on and the
 * stored text contains Devanagari. Content uses the whole document in auto mode, and
 * the existing `<lipi>` / `<lipi-shloka>` markers otherwise.
 */
export function lekha_has_script_selector(input: {
  title: string;
  description: string;
  content: string;
  auto_transliterate_title: boolean;
  auto_transliterate_description: boolean;
  auto_transliterate_content: boolean;
}) {
  if (input.auto_transliterate_title && contains_devanagari(input.title)) return true;
  if (input.auto_transliterate_description && contains_devanagari(input.description)) return true;
  if (input.auto_transliterate_content) return contains_devanagari(input.content);
  return LIPI_INDICATORS.some((indicator) => input.content.includes(indicator));
}
