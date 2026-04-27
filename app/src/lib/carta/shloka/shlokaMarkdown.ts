/**
 * `<shloka>…</shloka>`: multiline verse — each line break becomes `<br/>`; tags are removed in output
 * (same role as editor Carta `shloka` wrap). Used by `renderLekhaMarkdownToHtml`.
 */

const FENCE_SPLIT = /(```[\s\S]*?```)/g;

/** Match paired `<shloka>` (parse like `<lipi>` for consistency). */
export const SHLOKA_TAG_RE = /<\s*shloka\b[^>]*>([\s\S]*?)<\/\s*shloka\s*>/gi;

/**
 * Expands every `<shloka>` block: replace newlines in the inner text with `<br/>`, drop the tags.
 * Skips content inside ``` fenced code blocks. Runs after `<lipi>` transliteration, before video expansion.
 */
export function expandShlokaSpansInMarkdown(markdown: string): string {
  return markdown
    .split(FENCE_SPLIT)
    .map((part, i) => (i % 2 === 1 ? part : expandShlokaInPlain(part)))
    .join('');
}

function expandShlokaInPlain(md: string): string {
  return md.replace(SHLOKA_TAG_RE, (_, inner: string) => {
    const normalized = inner.replace(/\r\n/g, '\n');
    // No leading/trailing `<br/>` from empty first/last “lines” (e.g. editor `\n<shloka>\n…\n` padding).
    const core = normalized.replace(/^\n+|\n+$/g, '');
    if (core === '') return '';
    return core.split('\n').join('<br/>\n');
  });
}

/**
 * Remove stray `<shloka>` / `</shloka>` that reached HTML (e.g. malformed input); mirrors `stripLipiTagsFromHtml`.
 */
export function stripShlokaTagsFromHtml(html: string) {
  SHLOKA_TAG_RE.lastIndex = 0;
  let out = html;
  let prev = '';
  while (out !== prev) {
    prev = out;
    out = out.replace(SHLOKA_TAG_RE, '$1');
  }
  out = out.replace(/<\s*shloka\b[^>]*\s*\/?>/gi, '');
  out = out.replace(/<\/\s*shloka\s*>/gi, '');
  return out;
}
