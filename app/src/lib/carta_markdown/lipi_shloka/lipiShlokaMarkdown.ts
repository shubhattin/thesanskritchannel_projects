/**
 * `<lipi-shloka>…</lipi-shloka>` convenience wrapper: expanded to nested `<shloka>` + `<lipi>`
 * in `renderLekhaMarkdownToHtml` only. For save/format, whole blocks are preserved via
 * `isolateLipiShlokaBlocksForRemarkFormat` (not this expand).
 */

/** One protected `<lipi-shloka>` block plus the exact newline runs around it in the source. */
export type LipiShlokaFormatBlock = {
  html: string;
  /** Exact `\n` run immediately before the opening tag (may be empty). */
  leadingNewlines: string;
  /** Exact `\n` run immediately after the closing tag (may be empty). */
  trailingNewlines: string;
};

export function expandLipiShlokaCompoundTags(markdown: string): string {
  return markdown
    .replace(/<\s*lipi-shloka\b[^>]*>/gi, '<shloka>\n<lipi>')
    .replace(/<\s*\/\s*lipi-shloka\s*>/gi, '</lipi>\n</shloka>');
}

/** Non-greedy paired match for one block (no nesting). */
export const LIPI_SHLOKA_BLOCK_RE = /<\s*lipi-shloka\b[^>]*>[\s\S]*?<\s*\/\s*lipi-shloka\s*>/gi;

/** Void HTML sentinel — remark preserves adjacent single newlines (unlike HTML comments). */
function lipiShlokaFormatSentinel(index: number) {
  return `<lekha-fmt-lipi-shloka-${index}/>`;
}

const SENTINEL_RESTORE_RE = /<lekha-fmt-lipi-shloka-(\d+)\s*\/>\n*/g;

/**
 * remark-parse treats raw HTML blocks as ending at a blank line, so verse spacing inside
 * `<lipi-shloka>…</lipi-shloka>` corrupts formatting. Isolate each whole block behind a void
 * HTML sentinel before `remark-stringify`, then restore verbatim afterward.
 *
 * Leading/trailing newline runs around the block are peeled into metadata and reapplied on
 * restore. A blank line is inserted after each sentinel before following content so a
 * glued `prose<sentinel>\n---` cannot become a setext heading. Restore strips those
 * temporary newlines. HTML-comment sentinels made remark inject a blank line after the
 * block (`</lipi-shloka>\npara` → `</lipi-shloka>\n\npara`); void tags plus peel/restore
 * keep intentional single vs double newlines exact.
 */
export function isolateLipiShlokaBlocksForRemarkFormat(markdown: string) {
  LIPI_SHLOKA_BLOCK_RE.lastIndex = 0;
  const blocks: LipiShlokaFormatBlock[] = [];
  let out = '';
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = LIPI_SHLOKA_BLOCK_RE.exec(markdown)) !== null) {
    const html = m[0];
    const blockStart = m.index;
    const blockEnd = blockStart + html.length;

    let leadStart = blockStart;
    while (leadStart > last && markdown[leadStart - 1] === '\n') {
      leadStart--;
    }
    const leadingNewlines = markdown.slice(leadStart, blockStart);

    let trailEnd = blockEnd;
    while (trailEnd < markdown.length && markdown[trailEnd] === '\n') {
      trailEnd++;
    }
    const trailingNewlines = markdown.slice(blockEnd, trailEnd);

    out += markdown.slice(last, leadStart);
    const idx = blocks.length;
    blocks.push({ html, leadingNewlines, trailingNewlines });
    out += lipiShlokaFormatSentinel(idx);
    // Use a blank line before following content. A single `\n` after a sentinel glued to
    // preceding prose makes a following `---` parse as a setext underline (eating the HR
    // or escaping `\---`). Restore strips these temporary newlines and reapplies the
    // original trailing run, so `</lipi-shloka>\npara` adjacency stays exact.
    last = trailEnd;
    if (last < markdown.length) {
      out += '\n\n';
    }
  }
  out += markdown.slice(last);
  return { text: out, blocks };
}

/**
 * Restore isolated blocks. Strips the temporary / remark-injected newlines after each
 * sentinel and reapplies the original leading/trailing runs from {@link LipiShlokaFormatBlock}.
 */
export function restoreLipiShlokaBlocksAfterRemarkFormat(
  markdown: string,
  blocks: LipiShlokaFormatBlock[]
): string {
  return markdown.replace(SENTINEL_RESTORE_RE, (_, n) => {
    const idx = Number.parseInt(n, 10);
    const block = Number.isFinite(idx) ? blocks[idx] : undefined;
    if (!block) return '';
    return block.leadingNewlines + block.html + block.trailingNewlines;
  });
}
