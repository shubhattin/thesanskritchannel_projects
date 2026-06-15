import ms from 'ms';
import { REDIS_CACHE_KEYS_CLIENT } from '../../db/redis_shared';
import type { recursive_list_type, shloka_list_type } from '../../state/data_types';
import { get_path_params } from '../../state/project_list';
import { get_project_by_key, get_project_info_by_id } from '../project/list.server';
import { SiteLekhaSchemaZod } from '../../db/schema_zod';
import type z from 'zod';
import type { project_type } from '../../state/project_list';
import { and, eq } from 'drizzle-orm';
import { texts, translations } from '../../db/schema';
import { requireProjectPath } from '../project/paths_db.server';
import {
  createCachedLoader,
  NO_CACHE_PARAMS,
  type CachedLoader,
  type NoCacheParams
} from './create_cached_loader.server';
import type { db_options } from './cache_db_options.server';

const lekhaSchema = SiteLekhaSchemaZod;
type lekhaType = z.infer<typeof lekhaSchema>;

const lekhaListSchema = lekhaSchema.omit({ content: true }).array();
type lekhaListType = z.infer<typeof lekhaListSchema>;

const PROJECT_LIST_CACHE_TTL_S = ms('30days') / 1000;

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

/** Cache loader for `texts` */
export const get_text_data_func = (key: string, path_params: number[], options: db_options) =>
  load_text_data({ key, path_params }, options);

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

/** Cache loader for `translations` */
export const get_translation_data_func = (
  project_id: number,
  lang_id: number,
  selected_text_levels: (number | null)[],
  options: db_options
) => load_translation_data({ project_id, lang_id, selected_text_levels }, options);

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

/** Cache loader for `site_lekhas` */
export const get_site_lekha_data_func = (url_slug: string, options: db_options) =>
  load_site_lekha_data({ url_slug }, options);

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

export const get_site_lekha_list_func = (options: db_options) =>
  load_site_lekha_list(NO_CACHE_PARAMS, options);

const load_project_list = createCachedLoader<NoCacheParams, project_type[]>({
  getKey: () => REDIS_CACHE_KEYS_CLIENT.project_list(),
  ttlSeconds: PROJECT_LIST_CACHE_TTL_S,
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

/** Cache loader for `project_list` */
export const get_project_list_func = (options: db_options) =>
  load_project_list(NO_CACHE_PARAMS, options);

const load_project_map = createCachedLoader<{ project_id: number }, recursive_list_type>({
  getKey: ({ project_id }) => REDIS_CACHE_KEYS_CLIENT.project_map(project_id),
  ttlSeconds: PROJECT_LIST_CACHE_TTL_S,
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

/** Cache loader for `project_map` */
export const get_project_map_func = (project_id: number, options: db_options) =>
  load_project_map({ project_id }, options);

/**
 * Typed registry of cache loaders keyed by `REDIS_CACHE_KEYS_CLIENT` name.
 * Params / return types are explicit per entry — not derived from key builders alone.
 */
export type CacheLoaderRegistry = {
  project_list: CachedLoader<NoCacheParams, project_type[]>;
  project_map: CachedLoader<{ project_id: number }, recursive_list_type>;
  site_lekha_data: CachedLoader<{ url_slug: string }, lekhaType | null>;
  site_lekha_list: CachedLoader<NoCacheParams, lekhaListType>;
  text_data: CachedLoader<text_data_params, shloka_list_type>;
  translation: CachedLoader<translation_params, Map<number, string>>;
};

export const CACHED_LOADERS = {
  project_list: load_project_list,
  project_map: load_project_map,
  site_lekha_data: load_site_lekha_data,
  site_lekha_list: load_site_lekha_list,
  text_data: load_text_data,
  translation: load_translation_data
} satisfies CacheLoaderRegistry;
