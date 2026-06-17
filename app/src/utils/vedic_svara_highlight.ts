import { VEDIC_SVARAS } from '~/utils/normalize_text';

export type VedicSvaraKind = 'anudatta' | 'svarita' | 'karshana' | 'shara';

export type VedicSvaraHighlightSegment = {
  text: string;
  highlight?: boolean;
  svaraKind?: VedicSvaraKind;
};

export const VEDIC_SVARA_KIND = {
  '॒': 'anudatta',
  '॑': 'svarita',
  '᳚': 'karshana',
  '᳛': 'shara'
} as const satisfies Record<(typeof VEDIC_SVARAS)[number], VedicSvaraKind>;

const VEDIC_SVARA_SET = new Set<string>(VEDIC_SVARAS);
const VIRAMA = '\u094d';

const is_matra_or_nukta = (ch: string) => {
  const cp = ch.codePointAt(0)!;
  return cp === 0x093c || (cp >= 0x093e && cp <= 0x094c);
};

/** Highlight the syllable cluster the svara attaches to, not the mark alone. */
export const syllable_range_for_svara_at = (text: string, svara_index: number) => {
  let start = svara_index;
  let i = svara_index - 1;

  while (i >= 0 && is_matra_or_nukta(text[i]!)) i--;

  if (i >= 0) {
    while (i > 0 && text[i - 1] === VIRAMA) {
      i -= 2;
      while (i >= 0 && is_matra_or_nukta(text[i]!)) i--;
    }
    start = i;
  }

  return { start, end: svara_index + 1 };
};

export const split_text_for_vedic_svara_highlight = (
  text: string
): VedicSvaraHighlightSegment[] => {
  const ranges: Array<{ start: number; end: number; kind: VedicSvaraKind }> = [];

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    if (!VEDIC_SVARA_SET.has(ch)) continue;
    const { start, end } = syllable_range_for_svara_at(text, i);
    ranges.push({
      start,
      end,
      kind: VEDIC_SVARA_KIND[ch as keyof typeof VEDIC_SVARA_KIND]
    });
  }

  if (ranges.length === 0) return [{ text }];

  ranges.sort((a, b) => a.start - b.start);

  const segments: VedicSvaraHighlightSegment[] = [];
  let cursor = 0;
  for (const range of ranges) {
    if (range.start > cursor) {
      segments.push({ text: text.slice(cursor, range.start) });
    }
    segments.push({
      text: text.slice(range.start, range.end),
      highlight: true,
      svaraKind: range.kind
    });
    cursor = Math.max(cursor, range.end);
  }
  if (cursor < text.length) {
    segments.push({ text: text.slice(cursor) });
  }
  return segments;
};
