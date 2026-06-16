import { REDIS_CACHE_KEYS_CLIENT } from '../../db/redis_shared';
import type { recursive_list_type, shloka_list_type } from '../../state/data_types';
import { get_path_params } from '../../state/project_list';
import { get_project_by_key, get_project_info_by_id } from '../project/list.server';
import { SiteLekhaSchemaZod } from '../../db/schema_zod';
import type z from 'zod';
import type { project_type } from '../../state/project_list';
import { and, asc, eq, ne } from 'drizzle-orm';
import { media_attachment, texts, translations } from '../../db/schema';
import { requireProjectPath } from '../project/paths_db.server';
import type { PathSwapInvalidation } from '../map_path/swap_db.server';
import { dbPathToPathParams } from '../map_path/swap';
import {
  createCachedLoader,
  type CachedLoader,
  type NoCacheParams
} from './create_cached_loader.server';
import type { db_options } from './cache_db_options.server';

export { NO_CACHE_PARAMS } from './create_cached_loader.server';

const lekhaSchema = SiteLekhaSchemaZod;
type lekhaType = z.infer<typeof lekhaSchema>;

const lekhaListSchema = lekhaSchema.omit({ content: true }).array();
type lekhaListType = z.infer<typeof lekhaListSchema>;

type text_data_params = { key: string; path_params: number[] };

const load_text_data = createCachedLoader<text_data_params, shloka_list_type>({
  getKey: async ({ key, path_params }, options) => {
    const project = await get_project_by_key(key, options);
    if (!project) throw new Error(`Project not found: ${key}`);
    return REDIS_CACHE_KEYS_CLIENT.text_data(project.id, path_params);
  },
  fetch: async ({ key, path_params }, options) => {
    const project = await get_project_by_key(key, options);
    if (!project) throw new Error(`Project not found: ${key}`);
    const { db } = options;
    const projectPath = await requireProjectPath(db, project.id, path_params.join(':'));
    return db
      .select({
        text: texts.text,
        index: texts.index,
        shloka_num: texts.shloka_num
      })
      .from(texts)
      .where(eq(texts.project_path_id, projectPath.id))
      .orderBy(texts.index);
  }
});

type translation_row = { index: number; text: string };

type translation_params = {
  project_id: number;
  lang_id: number;
  selected_text_levels: (number | null)[];
};

const load_translation_data = createCachedLoader<
  translation_params,
  translation_row[],
  Map<number, string>
>({
  getKey: async ({ project_id, lang_id, selected_text_levels }, options) => {
    const { levels } = await get_project_info_by_id(project_id, options);
    const path_params = get_path_params(selected_text_levels, levels);
    if (levels > 1 && path_params.length === 0) {
      throw new Error('Invalid text path selection');
    }
    return REDIS_CACHE_KEYS_CLIENT.translation(project_id, lang_id, path_params);
  },
  fetch: async ({ project_id, lang_id, selected_text_levels }, options) => {
    const { db } = options;
    const { levels } = await get_project_info_by_id(project_id, options);
    const path_params = get_path_params(selected_text_levels, levels);
    if (levels > 1 && path_params.length === 0) {
      throw new Error('Invalid text path selection');
    }
    const projectPath = await requireProjectPath(db, project_id, path_params.join(':'));
    return db
      .select({
        index: translations.index,
        text: translations.text
      })
      .from(translations)
      .where(
        and(eq(translations.project_path_id, projectPath.id), eq(translations.lang_id, lang_id))
      )
      .orderBy(translations.index);
  },
  transform: (rows) => {
    const data_map = new Map<number, string>();
    for (const row of rows) data_map.set(row.index, row.text);
    return data_map;
  }
});

type available_translation_langs_params = {
  project_id: number;
  path_params: number[];
};

const load_available_translation_langs = createCachedLoader<
  available_translation_langs_params,
  number[]
>({
  getKey: ({ project_id, path_params }) =>
    REDIS_CACHE_KEYS_CLIENT.available_translation_langs(project_id, path_params),
  fetch: async ({ project_id, path_params }, { db }) => {
    const projectPath = await requireProjectPath(db, project_id, path_params.join(':'));
    const rows = await db
      .select({ lang_id: translations.lang_id })
      .from(translations)
      .where(and(eq(translations.project_path_id, projectPath.id), ne(translations.text, '')))
      .groupBy(translations.lang_id);
    return rows.map((row) => row.lang_id);
  }
});

type media_link_row = {
  id: number;
  lang_id: number | null;
  media_type: string;
  link: string;
  name: string;
  order: number;
};

type media_links_params = {
  project_id: number;
  path_params: number[];
};

const load_media_links = createCachedLoader<media_links_params, media_link_row[]>({
  getKey: ({ project_id, path_params }) =>
    REDIS_CACHE_KEYS_CLIENT.media_links(project_id, path_params),
  fetch: async ({ project_id, path_params }, { db }) => {
    const projectPath = await requireProjectPath(db, project_id, path_params.join(':'));
    return db
      .select({
        id: media_attachment.id,
        link: media_attachment.link,
        media_type: media_attachment.media_type,
        lang_id: media_attachment.lang_id,
        name: media_attachment.name,
        order: media_attachment.order
      })
      .from(media_attachment)
      .where(eq(media_attachment.project_path_id, projectPath.id))
      .orderBy(asc(media_attachment.order));
  }
});

const load_site_lekha_data = createCachedLoader<{ url_slug: string }, lekhaType | null>({
  getKey: ({ url_slug }) => REDIS_CACHE_KEYS_CLIENT.site_lekha_data(url_slug),
  schema: lekhaSchema,
  shouldCache: (data) => data !== null,
  fetch: async ({ url_slug }, { db }) => {
    const data = await db.query.site_lekhas.findFirst({
      where: (tbl, { eq }) => eq(tbl.url_slug, url_slug)
    });
    return data ?? null;
  }
});

/**
 * TODO : implement caching, paging and sorting
 *
 * Gives listed non-draft lekhas
 */
const load_site_lekha_list = createCachedLoader<NoCacheParams, lekhaListType>({
  getKey: () => REDIS_CACHE_KEYS_CLIENT.site_lekha_list(),
  schema: lekhaListSchema,
  fetch: async (_params, { db }) =>
    db.query.site_lekhas.findMany({
      columns: {
        id: true,
        title: true,
        description: true,
        tags: true,
        created_at: true,
        published_at: true,
        updated_at: true,
        draft: true,
        listed: true,
        search_indexed: true,
        url_slug: true
      },
      orderBy: ({ published_at }, { desc }) => desc(published_at),
      where: (tbl, { eq, and }) => and(eq(tbl.draft, false), eq(tbl.listed, true))
    })
});

const load_project_list = createCachedLoader<NoCacheParams, project_type[]>({
  getKey: () => REDIS_CACHE_KEYS_CLIENT.project_list(),
  fetch: async (_params, { db }) =>
    db.query.projects.findMany({
      columns: {
        id: true,
        name: true,
        name_dev: true,
        description: true,
        key: true,
        listed: true
      },
      orderBy: ({ id }, { asc }) => asc(id)
    })
});

const load_project_map = createCachedLoader<{ project_id: number }, recursive_list_type>({
  getKey: ({ project_id }) => REDIS_CACHE_KEYS_CLIENT.project_map(project_id),
  fetch: async ({ project_id }, { db }) => {
    const data = await db.query.projects.findFirst({
      where: (tbl, { eq }) => eq(tbl.id, project_id),
      columns: {
        id: true,
        map: true
      }
    });
    if (!data) throw new Error(`Project not found: ${project_id}`);
    return data.map;
  }
});

// Cache invalidation helper functions

const path_params_to_selected_text_levels = (
  path_params: number[],
  levels: number
): (number | null)[] => path_params.slice(0, levels - 1).reverse() as (number | null)[];

/** Await cache delete, then warm cache in background (prod only, via waitUntil). */
export const invalidate_and_refresh_cached = async <TParams, TData>(
  loader: CachedLoader<TParams, TData>,
  params: TParams,
  options: db_options
) => {
  await loader.delete(params, options);
  void loader.refresh(params, options, { deleteFirst: false });
};

/** Invalidate text/translation/media caches for map path edits. */
export const invalidate_path_caches = async (
  project_id: number,
  project_key: string,
  invalidation: PathSwapInvalidation,
  options: db_options
) => {
  const { levels } = await get_project_info_by_id(project_id, options);
  const tasks: Promise<void>[] = [];

  for (const path of invalidation.textAndMediaPaths) {
    const path_params = dbPathToPathParams(path);
    tasks.push(
      invalidate_and_refresh_cached(CACHE.text_data, { key: project_key, path_params }, options)
    );
    tasks.push(
      invalidate_and_refresh_cached(
        CACHE.available_translation_langs,
        { project_id, path_params },
        options
      )
    );
    tasks.push(CACHE.media_links.delete({ project_id, path_params }, options));
  }

  for (const { lang_id, path } of invalidation.translationPaths) {
    const path_params = dbPathToPathParams(path);
    const selected_text_levels = path_params_to_selected_text_levels(path_params, levels);
    tasks.push(
      invalidate_and_refresh_cached(
        CACHE.translation,
        { project_id, lang_id, selected_text_levels },
        options
      )
    );
  }

  await Promise.all(tasks);
};

/**
 * Typed registry of cache loaders keyed by `REDIS_CACHE_KEYS_CLIENT` name.
 * Params / return types are explicit per entry — not derived from key builders alone.
 */
export type CacheLoaderRegistry = {
  available_translation_langs: CachedLoader<available_translation_langs_params, number[]>;
  media_links: CachedLoader<media_links_params, media_link_row[]>;
  project_list: CachedLoader<NoCacheParams, project_type[]>;
  project_map: CachedLoader<{ project_id: number }, recursive_list_type>;
  site_lekha_data: CachedLoader<{ url_slug: string }, lekhaType | null>;
  site_lekha_list: CachedLoader<NoCacheParams, lekhaListType>;
  text_data: CachedLoader<text_data_params, shloka_list_type>;
  translation: CachedLoader<translation_params, Map<number, string>>;
};

export const CACHE = {
  available_translation_langs: load_available_translation_langs,
  media_links: load_media_links,
  project_list: load_project_list,
  project_map: load_project_map,
  site_lekha_data: load_site_lekha_data,
  site_lekha_list: load_site_lekha_list,
  text_data: load_text_data,
  translation: load_translation_data
} satisfies CacheLoaderRegistry;
