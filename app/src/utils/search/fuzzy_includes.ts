/** Edits allowed for a query word. Short words stay exact so `ra` does not fuzzy-hit everything. */
export const max_fuzzy_edits = (length: number): number => {
  if (length < 4) return 0;
  if (length < 8) return 1;
  return 2;
};

const row_a = new Uint16Array(96);
const row_b = new Uint16Array(96);

const levenshtein_window_within = (
  haystack: string,
  start: number,
  end: number,
  needle: string,
  max: number
): boolean => {
  const a_len = end - start;
  const b_len = needle.length;
  if (a_len < 0 || Math.abs(a_len - b_len) > max) return false;
  if (b_len + 1 > row_a.length) return false;

  const prev = row_a;
  const curr = row_b;
  for (let j = 0; j <= b_len; j++) prev[j] = j;

  for (let i = 1; i <= a_len; i++) {
    curr[0] = i;
    let row_min = i;
    const ca = haystack.charCodeAt(start + i - 1);
    for (let j = 1; j <= b_len; j++) {
      const cost = ca === needle.charCodeAt(j - 1) ? 0 : 1;
      const del = prev[j]! + 1;
      const ins = curr[j - 1]! + 1;
      const sub = prev[j - 1]! + cost;
      const val = del < ins ? (del < sub ? del : sub) : ins < sub ? ins : sub;
      curr[j] = val;
      if (val < row_min) row_min = val;
    }
    if (row_min > max) return false;
    for (let j = 0; j <= b_len; j++) prev[j] = curr[j]!;
  }
  return prev[b_len]! <= max;
};

/**
 * True when `needle` occurs in `haystack` within `max` insertions, deletions, or substitutions.
 * Both strings must already be folded. Patterns that do not fit the shared row buffers
 * fall back to a plain substring check.
 */
export const fuzzy_includes = (haystack: string, needle: string, max: number): boolean => {
  if (needle.length === 0) return true;
  if (haystack.includes(needle)) return true;
  if (max <= 0 || needle.length + 1 > row_a.length) return false;

  const n = needle.length;
  const min_size = Math.max(1, n - max);
  const max_size = Math.min(haystack.length, n + max);
  for (let size = min_size; size <= max_size; size++) {
    const last = haystack.length - size;
    for (let start = 0; start <= last; start++) {
      if (levenshtein_window_within(haystack, start, start + size, needle, max)) return true;
    }
  }
  return false;
};
