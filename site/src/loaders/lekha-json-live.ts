import { createMarkdownProcessor } from '@astrojs/markdown-remark';
import type { LiveLoader } from 'astro/loaders';
import { constants as fsConstants, existsSync } from 'node:fs';
import { access, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { z } from 'zod';
import { transliterate_node } from 'lipilekhika/node';
import { get_script_from_id, type script_list_type } from '$app/state/lang_list';
import { transliterate_custom } from '$app/tools/converter';
import { DEFAULT_SCRIPT_ID } from '~/lib/cookies';

export const lekha_schema_zod = z.object({
  title: z.string(),
  description: z.string().optional(),
  pubDate: z.coerce.date(),
  updatedDate: z.preprocess(
    (v) => (v === null || v === '' ? void 0 : v),
    z.coerce.date().optional()
  ),
  draft: z.boolean().default(false),
  search_index: z.boolean().optional(),
  listed: z.boolean().default(true),
  /** Omitted on `loadCollection` rows (index only); present on `loadEntry` (full post). */
  content: z.string().optional()
});
type LekhaPostJson = z.infer<typeof lekha_schema_zod>;

type LekhaListJson = { posts: string[] } | string[];

/**
 * Lekha reads JSON/MD from disk at runtime. Locally the loader may live under
 * `src/loaders/`; on Vercel the bundle is under `dist/server/chunks/`, so we
 * prefer `process.cwd()/src/content` (see @astrojs/vercel `includeFiles` /
 * `vite.assetsInclude`) and fall back to a path relative to this module.
 */
let cached_lekha_content_dir: string | null = null;

function lekha_content_dir(): string {
  if (cached_lekha_content_dir) return cached_lekha_content_dir;
  const cwd = process.cwd();
  const from_loader = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'content');
  /** Vercel NFT often places the repo under `site/` inside the function; local dev uses `src/content` at cwd. */
  const candidates = [
    path.join(cwd, 'src', 'content'),
    path.join(cwd, 'site', 'src', 'content'),
    from_loader
  ];
  for (const dir of candidates) {
    if (existsSync(path.join(dir, 'lekha_list.json'))) {
      cached_lekha_content_dir = dir;
      return dir;
    }
  }
  cached_lekha_content_dir = candidates[0];
  return cached_lekha_content_dir;
}

let markdownProcessor: Awaited<ReturnType<typeof createMarkdownProcessor>> | null = null;

const get_transliterated_text_content = async (content: string, script: script_list_type) => {
  return await transliterate_custom(content, 'Devanagari', script, undefined, transliterate_node);
};

/** `<lipi>…</lipi>` wraps Devanagari source; inner text is transliterated to the active script. */
const LIPI_TAG_RE = /<\s*lipi\b[^>]*>([\s\S]*?)<\/\s*lipi\s*>/gi;

/** Remove any `<lipi>` wrappers that survived markdown/HTML parsing (unknown elements, odd nesting). */
function strip_lipi_tags_from_html(html: string): string {
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

function script_from_id(script_id: number | undefined): script_list_type {
  const id = script_id ?? DEFAULT_SCRIPT_ID;
  const s = get_script_from_id(id);
  const fallback = get_script_from_id(DEFAULT_SCRIPT_ID);
  return (s ?? fallback ?? 'Devanagari') as script_list_type;
}

async function transliterate_lipi_spans(
  markdown: string,
  script: script_list_type
): Promise<string> {
  LIPI_TAG_RE.lastIndex = 0;
  const chunks: string[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = LIPI_TAG_RE.exec(markdown)) !== null) {
    chunks.push(markdown.slice(last, m.index));
    chunks.push(await get_transliterated_text_content(m[1], script));
    last = m.index + m[0].length;
  }
  chunks.push(markdown.slice(last));
  return chunks.join('');
}

async function getMarkdownProcessor() {
  if (!markdownProcessor) {
    markdownProcessor = await createMarkdownProcessor({
      syntaxHighlight: false,
      gfm: true,
      smartypants: true
    });
  }
  return markdownProcessor;
}

async function readOrderedIds(): Promise<string[]> {
  const list_path = path.join(lekha_content_dir(), 'lekha_list.json');
  const raw = JSON.parse(await readFile(list_path, 'utf-8')) as LekhaListJson;
  if (Array.isArray(raw)) return raw;
  if (raw && Array.isArray(raw.posts)) return raw.posts;
  throw new Error('lekha_list.json must be a string[] or { "posts": string[] }');
}

async function md_sidecar_exists(md_path: string): Promise<boolean> {
  try {
    await access(md_path, fsConstants.F_OK);
    return true;
  } catch {
    return false;
  }
}

/**
 * If `content` is like `welcome.md` and `src/content/lekha_md/welcome.md` exists, load that file.
 * Otherwise use `content` as inline Markdown. Only the basename is used (no `..`).
 */
async function resolve_lekha_markdown(
  content_field: string,
  post_id: string
): Promise<{ markdown: string; fileURL: URL }> {
  const trimmed = content_field.trim();
  const lekha_dir = path.join(lekha_content_dir(), 'lekha');
  const lekha_md_dir = path.join(lekha_content_dir(), 'lekha_md');
  const json_ref = pathToFileURL(path.join(lekha_dir, `${post_id}.json`));

  if (trimmed.toLowerCase().endsWith('.md')) {
    const safe_name = path.basename(trimmed.replace(/\\/g, '/'));
    if (safe_name && safe_name !== '.' && safe_name !== '..') {
      const md_path = path.join(lekha_md_dir, safe_name);
      if (await md_sidecar_exists(md_path)) {
        const markdown = await readFile(md_path, 'utf-8');
        return { markdown, fileURL: pathToFileURL(md_path) };
      }
    }
  }

  return { markdown: trimmed, fileURL: json_ref };
}

async function readPostJson(id: string): Promise<LekhaPostJson> {
  const filePath = path.join(lekha_content_dir(), 'lekha', `${id}.json`);
  const parsed = JSON.parse(await readFile(filePath, 'utf-8')) as LekhaPostJson;
  if (typeof parsed.title !== 'string' || typeof parsed.pubDate !== 'string') {
    throw new Error(`Invalid lekha JSON for "${id}": title and pubDate are required`);
  }
  if (typeof parsed.content !== 'string') {
    throw new Error(
      `Invalid lekha JSON for "${id}": content must be inline Markdown or a .md file under lekha_md/`
    );
  }
  return parsed;
}

function listEntryData(parsed: LekhaPostJson): Record<string, unknown> {
  const { content: _omit, ...meta } = parsed;
  return meta as Record<string, unknown>;
}

export type LekhaLiveEntryFilter = { id: string; scriptId?: number };

export function lekhaJsonLiveLoader(): LiveLoader<
  Record<string, unknown>,
  LekhaLiveEntryFilter,
  never
> {
  return {
    name: 'lekha-json-live',
    loadCollection: async () => {
      try {
        const ids = await readOrderedIds();
        const entries = await Promise.all(
          ids.map(async (id) => {
            const parsed = await readPostJson(id);
            return { id, data: listEntryData(parsed) };
          })
        );
        return { entries };
      } catch (error) {
        return {
          error: error instanceof Error ? error : new Error(String(error))
        };
      }
    },
    loadEntry: async ({ filter }) => {
      const id = filter.id;
      const script = script_from_id(filter.scriptId);
      try {
        const ids = await readOrderedIds();
        if (!ids.includes(id)) {
          return void 0;
        }
        const parsed = await readPostJson(id);
        const processor = await getMarkdownProcessor();
        const { markdown, fileURL } = await resolve_lekha_markdown(parsed.content ?? '', id);
        const markdown_for_render = await transliterate_lipi_spans(markdown, script);
        const { code: raw_html } = await processor.render(markdown_for_render, {
          fileURL
        });
        const html = strip_lipi_tags_from_html(raw_html);
        return {
          id,
          data: {
            title: parsed.title,
            description: parsed.description,
            pubDate: parsed.pubDate,
            updatedDate: parsed.updatedDate ?? void 0,
            draft: parsed.draft,
            content: parsed.content
          },
          rendered: { html }
        };
      } catch (error) {
        return {
          error: error instanceof Error ? error : new Error(String(error))
        };
      }
    }
  };
}
