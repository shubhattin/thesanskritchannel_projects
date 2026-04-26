/**
 * Shared lekha markdown utilities for app (and future site DB loader).
 * Sanitize dangerous constructs, normalize markdown, transliterate <lipi> spans, render HTML.
 */
import DOMPurify from 'isomorphic-dompurify';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkStringify from 'remark-stringify';
import remarkRehype from 'remark-rehype';
import rehypeStringify from 'rehype-stringify';
import type { script_list_type } from '~/state/lang_list';
import { transliterate_custom } from '~/tools/converter';

/** `<lipi>…</lipi>` wraps Devanagari source; inner text is transliterated for preview. */
export const LIPI_TAG_RE = /<\s*lipi\b[^>]*>([\s\S]*?)<\/\s*lipi\s*>/gi;

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

/**
 * Strip dangerous raw tags from markdown source while keeping `<lipi>` and typical inline HTML.
 * Does not parse full HTML; removes common XSS vectors in the text.
 */
export function removeDangerousTagsFromMarkdownSource(md: string) {
  let out = md;
  out = out.replace(/<\s*script\b[^>]*>[\s\S]*?<\s*\/\s*script\s*>/gi, '');
  out = out.replace(/<\s*style\b[^>]*>[\s\S]*?<\s*\/\s*style\s*>/gi, '');
  out = out.replace(/<\s*noscript\b[^>]*>[\s\S]*?<\s*\/\s*noscript\s*>/gi, '');
  out = out.replace(
    /<\s*(iframe|object|embed|link|meta|base)\b[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi,
    ''
  );
  out = out.replace(/<\s*(iframe|object|embed|link|meta|base)\b[^>]*\/?>/gi, '');
  out = out.replace(/<\s*\/\s*(iframe|object|embed)\s*>/gi, '');
  out = out.replace(/\]\(\s*javascript:/gi, '](');
  out = out.replace(/\]\(\s*data:/gi, '](');
  return out;
}

export async function transliterateLipiSpansInMarkdown(markdown: string, script: script_list_type) {
  LIPI_TAG_RE.lastIndex = 0;
  const chunks: string[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = LIPI_TAG_RE.exec(markdown)) !== null) {
    chunks.push(markdown.slice(last, m.index));
    chunks.push(await transliterate_custom(m[1], 'Devanagari', script));
    last = m.index + m[0].length;
  }
  chunks.push(markdown.slice(last));
  return chunks.join('');
}

/**
 * Render markdown to HTML (for admin preview or future site).
 * When `scriptId` is set, transliterates `<lipi>` inner text to that script before render.
 * This intentionally avoids Astro-specific server helpers so it can run in browser too.
 */
export async function renderLekhaMarkdownToHtml(
  markdown: string,
  options: { script: script_list_type }
) {
  const for_render = await transliterateLipiSpansInMarkdown(markdown, options.script);
  const file = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeStringify, { allowDangerousHtml: true })
    .process(for_render);
  const raw_html = file.toString();
  return stripLipiTagsFromHtml(raw_html);
}

/** DOMPurify config: keep `<lipi>`, inline styles, typical content markup. */
const PREVIEW_HTML_PURIFY = {
  ADD_TAGS: ['lipi'],
  ADD_ATTR: ['style', 'target', 'rel', 'href', 'alt', 'title', 'colspan', 'rowspan']
};

export function sanitizeRenderedHtmlForPreview(html: string) {
  return DOMPurify.sanitize(html, PREVIEW_HTML_PURIFY);
}

/** Carta / editor HTML sanitizer hook (same policy as preview). */
export function cartaHtmlSanitizer(dirty: string) {
  return DOMPurify.sanitize(dirty, PREVIEW_HTML_PURIFY);
}

/**
 * Normalize markdown (GFM) for consistent storage: list style, fences, line endings.
 */
export async function formatMarkdownSource(markdown: string): Promise<string> {
  const file = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkStringify, {
      bullet: '-',
      fences: true,
      rule: '-',
      emphasis: '*',
      strong: '*',
      listItemIndent: 'one',
      incrementListMarker: false
    })
    .process(markdown);
  return String(file).replace(/\r\n/g, '\n').trimEnd();
}

export function normalizeTagsForStorage(tags: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of tags) {
    const s = t.trim();
    if (!s) continue;
    const key = s.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
  }
  return out;
}

/** Matches API storage normalization for lekha `url_slug` (alphanumeric + hyphens). */
export function lekhaUrlSlugify(raw: string) {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+$/, ''); // Remove trailing hyphens
}

export function normalizeLekhaTextFields(input: {
  title: string;
  description: string;
  content: string;
  tags: string[];
  url_slug: string;
}) {
  return {
    url_slug: lekhaUrlSlugify(input.url_slug),
    title: input.title.trim(),
    description: input.description.trim(),
    content: input.content.replace(/\r\n/g, '\n'),
    tags: normalizeTagsForStorage(input.tags)
  };
}

/**
 * Pipeline for DB storage: strip dangerous tags, then remark-normalize markdown.
 * Call from API mutations; keep sync boundary explicit (await).
 */
export async function sanitizeAndFormatLekhaMarkdownForStorage(content: string) {
  const stripped = removeDangerousTagsFromMarkdownSource(content.replace(/\r\n/g, '\n'));
  return formatMarkdownSource(stripped);
}
