/** Devanagari digits and ASCII digits for verse markers after ॥. */
const VERSE_NUMBER_CHARS = '०-९0-9';

/**
 * High-confidence verse marker after a purna virama:
 * - ॥१-१-६॥
 * - ॥१॥
 * - ॥१ (opening marker without a closing ॥)
 */
export const SHLOKA_NUMBER_MARKER_RE = new RegExp(
  `॥\\s*[${VERSE_NUMBER_CHARS}]+(?:[-–—:.][${VERSE_NUMBER_CHARS}]+)*\\s*॥?`
);

const NON_EMPTY_LINES_RE = /[^\s]/;

export const get_non_empty_lines = (text: string): string[] =>
  text
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => NON_EMPTY_LINES_RE.test(line));

export const has_shloka_number_marker = (text: string): boolean =>
  SHLOKA_NUMBER_MARKER_RE.test(text);

/**
 * Rules-based shloka detector.
 *
 * - Single non-empty line → never a shloka
 * - 2+ non-empty lines containing ॥ → shloka
 */
export const is_shloka_text = (text: string): boolean => {
  const lines = get_non_empty_lines(text);
  if (lines.length < 2) return false;
  return text.includes('॥');
};

export const mark_shloka_types = (texts: readonly string[]): boolean[] =>
  texts.map((text) => is_shloka_text(text));

/** Sequential 1-based shloka numbers; `null` for non-shloka rows. */
export const derive_shloka_nums = (
  rows: readonly { shloka_type: boolean }[]
): (number | null)[] => {
  let shloka_num = 0;
  return rows.map((row) => {
    if (!row.shloka_type) return null;
    shloka_num++;
    return shloka_num;
  });
};

export const count_shlokas = (rows: readonly { shloka_type: boolean }[]): number =>
  rows.reduce((count, row) => count + (row.shloka_type ? 1 : 0), 0);
