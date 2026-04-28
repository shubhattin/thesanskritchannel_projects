import { transliterate } from 'lipilekhika';
import type { script_list_type } from '../../../state/lang_list';
import { transliterate_custom } from '../../../tools/converter';

/** `<lipi>…</lipi>` wraps Devanagari source; inner text is transliterated for preview. */
export const LIPI_TAG_RE = /<\s*lipi\b[^>]*>([\s\S]*?)<\/\s*lipi\s*>/gi;

export const LIPI_SPAN_CLASS = 'site_lipi_text_md';

function wrapLipiHtml(text: string) {
  const is_block = /\n\s*\n|<\s*shloka\b/i.test(text);
  if (!is_block) {
    return `<span class="${LIPI_SPAN_CLASS}">${text}</span>`;
  }
  return `<div class="${LIPI_SPAN_CLASS}">${text}</div>`;
  // const hasShlokaTag = /<\s*shloka\b/i.test(text);
  // if(hasShlokaTag){}
  // return `<p class="${LIPI_SPAN_CLASS}">${text}</p>`;
}

/** Remove stray `<lipi>` wrappers that survived markdown/HTML parsing. */
export function stripLipiTagsFromHtml(html: string) {
  return html.replace(/<\s*lipi\b[^>]*\s*\/?>/gi, '').replace(/<\/\s*lipi\s*>/gi, '');
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
    const text = await transliterate_custom(
      m[1],
      'Devanagari',
      script,
      undefined,
      lipilekhika_func ?? transliterate
    );
    chunks.push(wrapLipiHtml(text));
    last = m.index + m[0].length;
  }
  chunks.push(markdown.slice(last));
  return chunks.join('');
}
