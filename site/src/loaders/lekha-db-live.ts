import type { LiveLoader } from 'astro/loaders';
import { transliterate_node } from 'lipilekhika/node';
import { get_script_from_id, type script_list_type } from '@tsc/core/lang-list';
import { get_site_lekha_data_func, get_site_lekha_list_func } from '@tsc/server-data/cached-loader';
import { renderLekhaMarkdownToHtml } from '@tsc/lekha-markdown';
import { cache_db_options_site } from '~/db/cache_db_options';
import { DEFAULT_SCRIPT_ID } from '~/lib/cookies';

// enforces default script id if not provided
function script_from_id(script_id: number | undefined): script_list_type {
  const id = script_id ?? DEFAULT_SCRIPT_ID;
  const s = get_script_from_id(id);
  const fallback = get_script_from_id(DEFAULT_SCRIPT_ID);
  return (s ?? fallback ?? 'Devanagari') as script_list_type;
}

/** Indicators which tell if Script change component is needed */
const SCRIPT_INDICATORS = ['<lipi>', '<lipi-shloka>'] as const;

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
        const rows = await get_site_lekha_list_func(cache_db_options_site);
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
        const row = await get_site_lekha_data_func(slug, cache_db_options_site);
        if (!row) return void 0;
        if (row.draft || !row.listed) return void 0;

        const html = await renderLekhaMarkdownToHtml(row.content, {
          script,
          lipiTransliterator: transliterate_node
        });

        return {
          id: row.url_slug,
          data: row,
          has_script_indicator: SCRIPT_INDICATORS.some((indicator) =>
            row.content.includes(indicator)
          ),
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
