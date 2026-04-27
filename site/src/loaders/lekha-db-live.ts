import type { LiveLoader } from 'astro/loaders';
import { transliterate_node } from 'lipilekhika/node';
import { get_script_from_id, type script_list_type } from '$app/state/lang_list';
import { get_site_lekha_data_func, get_site_lekha_list_func } from '$app/server/cached_loader';
import { renderLekhaMarkdownToHtml } from '$app/utils/markdown';
import { z } from 'zod';
import { db, redis } from '~/db/site_db';
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
  tags: z.array(z.string()).optional(),
  /** Omitted on `loadCollection` rows (index only); present on `loadEntry` (full post). */
  content: z.string().optional()
});

type LekhaPostData = z.infer<typeof lekha_schema_zod>;

type SiteLekhaListRow = Awaited<ReturnType<typeof get_site_lekha_list_func>>[number];

function script_from_id(script_id: number | undefined): script_list_type {
  const id = script_id ?? DEFAULT_SCRIPT_ID;
  const s = get_script_from_id(id);
  const fallback = get_script_from_id(DEFAULT_SCRIPT_ID);
  return (s ?? fallback ?? 'Devanagari') as script_list_type;
}

function listEntryData(row: SiteLekhaListRow): Record<string, unknown> {
  return {
    title: row.title,
    description: row.description,
    pubDate: row.published_at,
    updatedDate: row.updated_at,
    draft: row.draft,
    listed: row.listed,
    search_index: row.search_indexed,
    tags: row.tags
  };
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
        const rows = await get_site_lekha_list_func({ db, redis });
        const entries = rows.map((row: SiteLekhaListRow) => ({
          id: row.url_slug,
          data: listEntryData(row)
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
        const id_row = await db.query.site_lekhas.findFirst({
          columns: { id: true },
          where: (tbl, { eq: eqFn }) => eqFn(tbl.url_slug, slug)
        });
        if (!id_row) return void 0;

        const row = await get_site_lekha_data_func(id_row.id, { db, redis });
        if (!row) return void 0;
        if (row.draft || !row.listed) return void 0;

        const html = await renderLekhaMarkdownToHtml(row.content, {
          script,
          lipiTransliterator: transliterate_node
        });

        const data: LekhaPostData = {
          title: row.title,
          description: row.description,
          pubDate: row.published_at,
          updatedDate: row.updated_at,
          draft: row.draft,
          search_index: row.search_indexed,
          listed: row.listed,
          tags: row.tags,
          content: row.content
        };

        return {
          id: row.url_slug,
          data,
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
