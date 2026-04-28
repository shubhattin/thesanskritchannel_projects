import { transliterate } from 'lipilekhika';
import type { script_list_type } from '~/state/lang_list';
import { transliterate_custom } from '~/tools/converter';

/** `<lipi>…</lipi>` wraps Devanagari source; inner text is transliterated for preview. */
export const LIPI_TAG_RE = /<\s*lipi\b[^>]*>([\s\S]*?)<\/\s*lipi\s*>/gi;

export const LIPI_SPAN_CLASS = 'site_lipi_text_md';

/** Remove `<lipi>` wrappers that survived markdown/HTML parsing. */
export function stripLipiTagsFromHtml(html: string) {
  LIPI_TAG_RE.lastIndex = 0;
  let out = html;
  let prev = '';
  while (out !== prev) {
    prev = out;
    out = out.replace(LIPI_TAG_RE, '$1');
  }
  out = out.replace(/<\s*lipi\b[^>]*\s*\/?>/gi, '');
  out = out.replace(/<\/\s*lipi\s*>/gi, '');
  return out;
}

export async function transliterateLipiSpansInMarkdown(
  markdown: string,
  script: script_list_type,
  lipilekhika_func: typeof transliterate | undefined = undefined
) {
  LIPI_TAG_RE.lastIndex = 0;
  const chunks: string[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = LIPI_TAG_RE.exec(markdown)) !== null) {
    chunks.push(markdown.slice(last, m.index));
    chunks.push(
      await transliterate_custom(
        m[1],
        'Devanagari',
        script,
        undefined,
        lipilekhika_func ?? transliterate
      )
    );
    last = m.index + m[0].length;
  }
  chunks.push(markdown.slice(last));
  return chunks.join('');
}
