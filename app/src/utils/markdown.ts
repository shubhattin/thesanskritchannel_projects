/**
 * Shared lekha markdown utilities for app (and future site DB loader).
 * Sanitize dangerous constructs, normalize markdown, transliterate <lipi>, expand <shloka>, render HTML.
 *
 * Uses `dompurify` + `linkedom` on the server (not `isomorphic-dompurify` / jsdom) so Vercel's NFT
 * bundler does not follow jsdom's optional `canvas` peer, which is often missing and breaks `realpath`.
 */
import createDOMPurify from 'dompurify';
import type { Config, WindowLike } from 'dompurify';
import { parseHTML } from 'linkedom/worker';
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkStringify from 'remark-stringify';
import remarkRehype from 'remark-rehype';
import rehypeStringify from 'rehype-stringify';
import type { script_list_type } from '../state/lang_list';
import { expandCartaStyleVideoEmbedsInMarkdown } from '../lib/carta/video/cartaVideoEmbeds';
import {
  expandShlokaSpansInMarkdown,
  stripShlokaTagsFromHtml
} from '../lib/carta/shloka/shlokaMarkdown';
import { transliterate } from 'lipilekhika';
import {
  stripLipiTagsFromHtml,
  transliterateLipiSpansInMarkdown
} from '../lib/carta/lipi/lipiMarkdown';

export { expandCartaStyleVideoEmbedsInMarkdown };
export {
  expandShlokaSpansInMarkdown,
  stripShlokaTagsFromHtml,
  SHLOKA_TAG_RE
} from '../lib/carta/shloka/shlokaMarkdown';

/**
 * Best-effort cleanup of raw markdown source (nested tags and parser quirks can bypass this).
 * Not a security boundary — final HTML must be sanitized (see `renderLekhaMarkdownToHtml`).
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

/** DOMPurify config: keep `<lipi>`, inline styles, typical content markup, video embed HTML (`cartaVideoEmbeds`). */
const PREVIEW_HTML_PURIFY: Config = {
  ADD_TAGS: ['lipi', 'iframe', 'u', 'div'],
  ADD_ATTR: [
    'style',
    'target',
    'rel',
    'href',
    'alt',
    'title',
    'colspan',
    'rowspan',
    'class',
    'src',
    'width',
    'height',
    'frameborder',
    'allow',
    'allowfullscreen',
    'loading',
    'referrerpolicy'
  ]
};

let server_purify: ReturnType<typeof createDOMPurify> | undefined;

function get_dom_purify(): ReturnType<typeof createDOMPurify> {
  if (typeof window !== 'undefined' && window.document) {
    return createDOMPurify(window as unknown as WindowLike);
  }
  if (!server_purify) {
    const linkedom_window = parseHTML('<!DOCTYPE html><html><body></body></html>');
    server_purify = createDOMPurify(linkedom_window as unknown as WindowLike);
  }
  return server_purify;
}

export function sanitizeRenderedHtmlForPreview(html: string) {
  return get_dom_purify().sanitize(html, PREVIEW_HTML_PURIFY);
}

/** Carta / editor HTML sanitizer hook (same policy as preview). */
export function cartaHtmlSanitizer(dirty: string) {
  return get_dom_purify().sanitize(dirty, PREVIEW_HTML_PURIFY);
}

/**
 * Render markdown to HTML (for admin preview or site).
 * When `script` is set, transliterates `<lipi>` inner text to that script before render.
 * Pass `lipiTransliterator` (e.g. `transliterate_node` from `lipilekhika/node`) on the server for faster batch transliteration.
 * This intentionally avoids Astro-specific server helpers so it can run in browser too.
 *
 * Runs `removeDangerousTagsFromMarkdownSource` on the source unless `skipSourceSanitization: true`
 * (cosmetic pre-pass only). Output HTML is always sanitized with `PREVIEW_HTML_PURIFY` / DOMPurify
 * after markdown → HTML (including `allowDangerousHtml` in the unified pipeline).
 */
export async function renderLekhaMarkdownToHtml(
  markdown: string,
  options: {
    script: script_list_type;
    lipiTransliterator?: typeof transliterate;
    skipSourceSanitization?: boolean;
  }
) {
  const normalized = markdown.replace(/\r\n/g, '\n');
  const md =
    options.skipSourceSanitization === true
      ? normalized
      : removeDangerousTagsFromMarkdownSource(normalized);
  // lipi plugin
  const after_lipi = await transliterateLipiSpansInMarkdown(
    md,
    options.script,
    options.lipiTransliterator
  );
  // shloka plugin
  const with_shloka = expandShlokaSpansInMarkdown(after_lipi);
  // video plugin
  const with_videos = expandCartaStyleVideoEmbedsInMarkdown(with_shloka);
  const file = await unified()
    .use(remarkParse)
    .use(remarkGfm)
    .use(remarkRehype, { allowDangerousHtml: true })
    .use(rehypeStringify, { allowDangerousHtml: true })
    .process(with_videos);
  const raw_html = file.toString();
  const after_custom_tags = stripShlokaTagsFromHtml(stripLipiTagsFromHtml(raw_html));
  return sanitizeRenderedHtmlForPreview(after_custom_tags);
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
    .replace(/^-+/, '')
    .replace(/-+$/, '');
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
 * Pipeline for DB storage: optional source cleanup, then remark-normalize markdown (no HTML render).
 * XSS is enforced when rendering via `renderLekhaMarkdownToHtml` (DOMPurify on output).
 */
export async function sanitizeAndFormatLekhaMarkdownForStorage(content: string) {
  const stripped = removeDangerousTagsFromMarkdownSource(content.replace(/\r\n/g, '\n'));
  return formatMarkdownSource(stripped);
}
