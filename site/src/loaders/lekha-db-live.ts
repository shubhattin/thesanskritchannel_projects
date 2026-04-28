import type { LiveLoader } from 'astro/loaders';
import { transliterate_node } from 'lipilekhika/node';
import { get_script_from_id, type script_list_type } from '$app/state/lang_list';
import { get_site_lekha_data_func, get_site_lekha_list_func } from '$app/server/cached_loader';
import { renderLekhaMarkdownToHtml } from '$app/lib/carta_markdown/markdown';
import { db, redis } from '~/db/site_db';
import { DEFAULT_SCRIPT_ID } from '~/lib/cookies';
import { waitUntil } from '@vercel/functions';

// enforces default script id if not provided
function script_from_id(script_id: number | undefined): script_list_type {
  const id = script_id ?? DEFAULT_SCRIPT_ID;
  const s = get_script_from_id(id);
  const fallback = get_script_from_id(DEFAULT_SCRIPT_ID);
  return (s ?? fallback ?? 'Devanagari') as script_list_type;
}

export type LekhaLiveEntryFilter = { id: string; scriptId?: number };

export function lekhaDbLiveLoader(): LiveLoader<
  Record<string, unknown>,
  LekhaLiveEntryFilter,
  never
> {
  return {
    name: 'lekha-db-live',
    loadCollection: async () => {
      try {
        const rows = await get_site_lekha_list_func({ db, redis, defer: waitUntil });
        const entries = rows.map((row) => ({
          id: row.url_slug, // the collection needs a slug as id
          data: row
        }));
        return { entries };
      } catch (error) {
        return {
          error: error instanceof Error ? error : new Error(String(error))
        };
      }
    },
    loadEntry: async ({ filter }) => {
      const slug = filter.id;
      const script = script_from_id(filter.scriptId);
      try {
        const row = await get_site_lekha_data_func(slug, { db, redis, defer: waitUntil });
        if (!row) return void 0;
        if (row.draft || !row.listed) return void 0;

        const html = await renderLekhaMarkdownToHtml(row.content, {
          script,
          lipiTransliterator: transliterate_node
        });

        return {
          id: row.url_slug,
          data: row,
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
