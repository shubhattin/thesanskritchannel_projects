import { createMarkdownProcessor } from '@astrojs/markdown-remark';
import type { LiveLoader } from 'astro/loaders';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

type LekhaPostJson = {
  title: string;
  description?: string;
  pubDate: string;
  updatedDate?: string | null;
  draft?: boolean;
  content: string;
};

type LekhaListJson = { posts: string[] } | string[];

const SRC_DIR = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const LIST_PATH = path.join(SRC_DIR, 'content', 'lekha_list.json');
const LEKHA_DIR = path.join(SRC_DIR, 'content', 'lekha');

let markdownProcessor: Awaited<ReturnType<typeof createMarkdownProcessor>> | null = null;

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
  const raw = JSON.parse(await readFile(LIST_PATH, 'utf-8')) as LekhaListJson;
  if (Array.isArray(raw)) return raw;
  if (raw && Array.isArray(raw.posts)) return raw.posts;
  throw new Error('lekha_list.json must be a string[] or { "posts": string[] }');
}

async function readPostJson(id: string): Promise<LekhaPostJson> {
  const filePath = path.join(LEKHA_DIR, `${id}.json`);
  const parsed = JSON.parse(await readFile(filePath, 'utf-8')) as LekhaPostJson;
  if (typeof parsed.title !== 'string' || typeof parsed.pubDate !== 'string') {
    throw new Error(`Invalid lekha JSON for "${id}": title and pubDate are required`);
  }
  if (typeof parsed.content !== 'string') {
    throw new Error(`Invalid lekha JSON for "${id}": content must be a Markdown string`);
  }
  return parsed;
}

function listEntryData(parsed: LekhaPostJson): Record<string, unknown> {
  const { content: _omit, ...meta } = parsed;
  return meta as Record<string, unknown>;
}

export function lekhaJsonLiveLoader(): LiveLoader<
  Record<string, unknown>,
  { id: string },
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
      try {
        const ids = await readOrderedIds();
        if (!ids.includes(id)) {
          return void 0;
        }
        const parsed = await readPostJson(id);
        const processor = await getMarkdownProcessor();
        const pseudoFile = path.join(LEKHA_DIR, `${id}.json`);
        const { code: html } = await processor.render(parsed.content, {
          fileURL: pathToFileURL(pseudoFile)
        });
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
