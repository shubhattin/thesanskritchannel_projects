/**
 * `<lipi-shloka>…</lipi-shloka>` convenience wrapper: expanded to nested `<shloka>` + `<lipi>`
 * in `renderLekhaMarkdownToHtml` only. For save/format, whole blocks are preserved via
 * `isolateLipiShlokaBlocksForRemarkFormat` (not this expand).
 */
export function expandLipiShlokaCompoundTags(markdown: string): string {
  return markdown
    .replace(/<\s*lipi-shloka\b[^>]*>/gi, '<shloka>\n<lipi>')
    .replace(/<\s*\/\s*lipi-shloka\s*>/gi, '</lipi>\n</shloka>');
}

/** Non-greedy paired match for one block (no nesting). */
export const LIPI_SHLOKA_BLOCK_RE = /<\s*lipi-shloka\b[^>]*>[\s\S]*?<\s*\/\s*lipi-shloka\s*>/gi;

/**
 * remark-parse treats raw HTML blocks as ending at a blank line, so verse spacing inside
 * `<lipi-shloka>…</lipi-shloka>` corrupts formatting. Isolate each whole block behind an HTML comment
 * before `remark-stringify`, then restore verbatim afterward.
 */
export function isolateLipiShlokaBlocksForRemarkFormat(markdown: string): {
  text: string;
  blocks: string[];
} {
  LIPI_SHLOKA_BLOCK_RE.lastIndex = 0;
  const blocks: string[] = [];
  const text = markdown.replace(LIPI_SHLOKA_BLOCK_RE, (whole) => {
    const idx = blocks.length;
    blocks.push(whole);
    /** No injected newlines — surrounding markdown already contributed line breaks before/after each block */
    return `<!--lekha-fmt-lipi-shloka:${idx}-->`;
  });
  return { text, blocks };
}

export function restoreLipiShlokaBlocksAfterRemarkFormat(
  markdown: string,
  blocks: string[]
): string {
  return markdown.replace(/<!--\s*lekha-fmt-lipi-shloka:(\d+)\s*-->/g, (_, n) => {
    const idx = Number.parseInt(n, 10);
    return Number.isFinite(idx) ? (blocks[idx] ?? '') : '';
  });
}
