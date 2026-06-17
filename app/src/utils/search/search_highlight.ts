import { VEDIC_SVARAS, remove_vedic_svara_chihnAni } from '~/utils/normalize_text';

export type SearchHighlightSegment = {
  text: string;
  highlight: boolean;
};

const VEDIC_SVARA_SET = new Set<string>(VEDIC_SVARAS);

/** Maps each index in the svara-stripped text back to its start index in `original`. */
export const build_sanitized_text_index_map = (original: string) => {
  const sanitizedStarts: number[] = [];
  let sanitized = '';
  for (let i = 0; i < original.length; i++) {
    const ch = original[i]!;
    if (VEDIC_SVARA_SET.has(ch)) continue;
    sanitizedStarts.push(i);
    sanitized += ch;
  }
  return { sanitized, sanitizedStarts };
};

const original_range_for_sanitized_match = (
  original: string,
  sanitizedStarts: number[],
  matchStart: number,
  matchEnd: number
) => {
  const originalStart = sanitizedStarts[matchStart] ?? original.length;
  const originalEnd =
    matchEnd < sanitizedStarts.length ? sanitizedStarts[matchEnd]! : original.length;
  return { originalStart, originalEnd };
};

/**
 * Highlights `text` using the raw `query`, matching on svara-stripped forms so Vedic marks
 * in the source text do not block a hit. Highlighted slices always come from `text`.
 */
export const split_text_by_search_query = (
  text: string,
  query: string
): SearchHighlightSegment[] => {
  const sanitizedQuery = remove_vedic_svara_chihnAni(query.trim());
  if (!sanitizedQuery) return [{ text, highlight: false }];

  const { sanitized, sanitizedStarts } = build_sanitized_text_index_map(text);
  if (!sanitized) return [{ text, highlight: false }];

  const segments: SearchHighlightSegment[] = [];
  let lastOriginalEnd = 0;
  let searchFrom = 0;

  while (searchFrom < sanitized.length) {
    const matchStart = sanitized.indexOf(sanitizedQuery, searchFrom);
    if (matchStart === -1) break;

    const matchEnd = matchStart + sanitizedQuery.length;
    const { originalStart, originalEnd } = original_range_for_sanitized_match(
      text,
      sanitizedStarts,
      matchStart,
      matchEnd
    );

    if (originalStart > lastOriginalEnd) {
      segments.push({ text: text.slice(lastOriginalEnd, originalStart), highlight: false });
    }
    segments.push({ text: text.slice(originalStart, originalEnd), highlight: true });
    lastOriginalEnd = originalEnd;
    searchFrom = matchEnd;
  }

  if (lastOriginalEnd < text.length) {
    segments.push({ text: text.slice(lastOriginalEnd), highlight: false });
  }

  return segments.length ? segments : [{ text, highlight: false }];
};
