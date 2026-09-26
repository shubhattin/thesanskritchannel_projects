import { remove_vedic_svara_chihnAni } from '../normalize_text';

const is_latin_letter = (cp: number) =>
  (cp >= 0x41 && cp <= 0x5a) ||
  (cp >= 0x61 && cp <= 0x7a) ||
  (cp >= 0xc0 && cp <= 0x24f) ||
  (cp >= 0x1e00 && cp <= 0x1eff);

/** Combining marks produced by NFD of Latin letters (not Brahmic vowel signs). */
const is_latin_combining = (cp: number) =>
  (cp >= 0x300 && cp <= 0x36f) || (cp >= 0x1ab0 && cp <= 0x1aff) || (cp >= 0x1dc0 && cp <= 0x1dff);

/**
 * Search fold: Latin diacritics and case drop away (`rāma` → `rama`), vedic svara
 * marks are removed, and Brahmic vowel signs stay intact.
 */
export const fold_search_text = (text: string): string => {
  const nfd = remove_vedic_svara_chihnAni(text).normalize('NFD');
  let out = '';
  let latin_base = false;
  for (const ch of nfd) {
    const cp = ch.codePointAt(0);
    if (cp === undefined) continue;
    if (latin_base && is_latin_combining(cp)) continue;
    if (is_latin_letter(cp)) {
      latin_base = true;
      out += cp >= 0x41 && cp <= 0x5a ? String.fromCharCode(cp + 32) : ch.toLowerCase();
      continue;
    }
    latin_base = false;
    out += ch;
  }
  return out;
};
