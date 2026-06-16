export type SearchHighlightSegment = {
  text: string;
  highlight: boolean;
};

export const split_text_by_search_query = (
  text: string,
  query: string
): SearchHighlightSegment[] => {
  const q = query.trim();
  if (!q) return [{ text, highlight: false }];

  const segments: SearchHighlightSegment[] = [];
  let i = 0;
  while (i < text.length) {
    const idx = text.indexOf(q, i);
    if (idx === -1) {
      segments.push({ text: text.slice(i), highlight: false });
      break;
    }
    if (idx > i) segments.push({ text: text.slice(i, idx), highlight: false });
    segments.push({ text: text.slice(idx, idx + q.length), highlight: true });
    i = idx + q.length;
  }
  return segments.length ? segments : [{ text, highlight: false }];
};
