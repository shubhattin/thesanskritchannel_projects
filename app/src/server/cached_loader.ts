import ms from 'ms';
import { REDIS_CACHE_KEYS_CLIENT } from '../db/redis_shared';
import type { recursive_list_type, shloka_list_type } from '../state/data_types';
import { get_path_params } from '../state/project_list';
import { get_project_by_key, get_project_info_by_id } from './project_list.server';
import type { Redis } from '@upstash/redis/cloudflare';
import type { db } from '~/db/db';
import { SiteLekhaSchemaZod } from '../db/schema_zod';
import { waitUntil } from '@vercel/functions';
import type z from 'zod';
import type { project_type } from '../state/project_list';

export type defer_promise_type = (promise: Promise<unknown>) => void;

const defer_promise = (promise: Promise<unknown>, defer?: defer_promise_type) => {
  const defer_func = defer ?? waitUntil;
  defer_func(promise);
  void promise.catch(() => {});
};

type DBType = typeof db;
/** Cross project db, redis instances */
export type db_options = {
  defer?: defer_promise_type;
  db: DBType;
  redis: Redis;
};

/** Cache laoder for `texts` */
export const get_text_data_func = async (
  key: string,
  path_params: number[],
  options: db_options
) => {
  const { db, redis } = options;

  const project = await get_project_by_key(key, options);
  if (!project) throw new Error(`Project not found: ${key}`);
  const project_id = project.id;
  if (import.meta.env.DEV) {
    // only for LOCAL DEV
    const { resolve } = await import('node:path');
    const { fileURLToPath } = await import('node:url');

    const get_text_data_loc = (project_id: number, key: string, path_params: number[]) =>
      `data/${project_id}. ${key}/data` +
      (path_params.length !== 0 ? `/${path_params.join('/')}.json` : `.json`);
    const repo_root = resolve(fileURLToPath(new URL('.', import.meta.url)), '../../..');
    const get_text_data_file_path = (project_id: number, key: string, path_params: number[]) =>
      resolve(repo_root, get_text_data_loc(project_id, key, path_params));
    const fs = await import('node:fs');

    return JSON.parse(
      fs.readFileSync(get_text_data_file_path(project_id, key, path_params), 'utf8')
    ) as shloka_list_type;
  }

  const cache_key = REDIS_CACHE_KEYS_CLIENT.text_data(project_id, path_params);
  const cache = await redis.get<shloka_list_type>(cache_key);
  if (cache) return cache;

  const data = await db.query.texts.findMany({
    columns: {
      text: true,
      index: true,
      shloka_num: true
    },
    where: (tbl, { eq, and }) =>
      and(eq(tbl.project_id, project_id), eq(tbl.path, path_params.join(':'))),
    orderBy: ({ index }, { asc }) => asc(index)
  });

  defer_promise(
    redis.set(cache_key, data, {
      ex: ms('30days') / 1000
    }),
    options.defer
  );

  return data satisfies shloka_list_type;
};

/** Cache laoder for `translations` */
export const get_translation_data_func = async (
  project_id: number,
  lang_id: number,
  selected_text_levels: (number | null)[],
  options: db_options
) => {
  let data: {
    index: number;
    text: string;
  }[] = [];

  const { db, redis } = options;

  const { levels } = await get_project_info_by_id(project_id, options);
  const path_params = get_path_params(selected_text_levels, levels);
  const path = path_params.join(':');
  let cache = null;
  if (import.meta.env.PROD) {
    cache = await redis.get<typeof data>(
      REDIS_CACHE_KEYS_CLIENT.translation(project_id, lang_id, path_params)
    );
  }
  if (cache) data = cache;
  else {
    data = await db.query.translations.findMany({
      columns: {
        index: true,
        text: true
      },
      where: (tbl, { eq, and }) =>
        and(eq(tbl.project_id, project_id), eq(tbl.lang_id, lang_id), eq(tbl.path, path)),
      orderBy: ({ index }, { asc }) => asc(index)
    });
    if (import.meta.env.PROD) {
      // set cache in background
      defer_promise(
        redis.set(REDIS_CACHE_KEYS_CLIENT.translation(project_id, lang_id, path_params), data, {
          ex: ms('30days') / 1000
        }),
        options.defer
      );
    }
  }
  const data_map = new Map<number, string>();
  for (let i = 0; i < data.length; i++) data_map.set(data[i].index, data[i].text);
  return data_map;
};

const lekhaSchema = SiteLekhaSchemaZod;
type lekhaType = z.infer<typeof lekhaSchema>;

/** Cache laoder for `site_lekhas` */
export const get_site_lekha_data_func = async (
  url_slug: string,
  options: db_options
): Promise<lekhaType | null> => {
  const { db, redis } = options;
  const cache_key = REDIS_CACHE_KEYS_CLIENT.site_lekha_data(url_slug);

  let cache = null;
  if (import.meta.env.PROD) cache = await redis.get<lekhaType>(cache_key);
  // parsing is also essential here as we have string types for timestamps
  // that have to be coered to Date Objects
  if (cache) return lekhaSchema.parse(cache);

  const data = await db.query.site_lekhas.findFirst({
    where: (tbl, { eq }) => eq(tbl.url_slug, url_slug)
  });
  if (!data) return null;
  if (import.meta.env.PROD) {
    defer_promise(
      redis.set(cache_key, data, {
        ex: ms('30days') / 1000
      }),
      options.defer
    );
  }
  return data satisfies lekhaType;
};

const lekhaListSchema = lekhaSchema.omit({ content: true }).array();
type lekhaListType = z.infer<typeof lekhaListSchema>;
/**
 * TODO : implement caching, paging and sorting
 *
 * Gives listed non-draft lekhas
 */
export const get_site_lekha_list_func = async (options: db_options): Promise<lekhaListType> => {
  const { db, redis } = options;
  const cache_key = REDIS_CACHE_KEYS_CLIENT.site_lekha_list();

  let cache = null;
  if (import.meta.env.PROD) {
    cache = await redis.get<lekhaListType>(cache_key);
  }
  if (cache) return lekhaListSchema.parse(cache);

  const data = await db.query.site_lekhas.findMany({
    columns: {
      id: true,
      title: true,
      description: true,
      tags: true,
      published_at: true,
      updated_at: true,
      draft: true,
      listed: true,
      search_indexed: true,
      url_slug: true
    },
    orderBy: ({ published_at }, { desc }) => desc(published_at),
    where: (tbl, { eq, and }) => and(eq(tbl.draft, false), eq(tbl.listed, true))
  });

  if (import.meta.env.PROD) {
    defer_promise(
      redis.set(cache_key, data, {
        ex: ms('30days') / 1000
      }),
      options.defer
    );
  }

  return data satisfies lekhaListType;
};

const PROJECT_LIST_CACHE_REFRESH_INTERVAL_MS = ms('30days');

/** Cache laoder for `project_list` */
export const get_project_list_func = async (options: db_options): Promise<project_type[]> => {
  const { db, redis } = options;
  const cache_key = REDIS_CACHE_KEYS_CLIENT.project_list();
  let cache = null;
  if (import.meta.env.PROD) {
    cache = await redis.get<project_type[]>(cache_key);
  }
  if (cache) return cache;

  const data = await db.query.projects.findMany({
    columns: {
      id: true,
      name: true,
      name_dev: true,
      description: true,
      key: true,
      listed: true
    },
    orderBy: ({ id }, { asc }) => asc(id)
  });
  if (import.meta.env.PROD) {
    defer_promise(
      redis.set(cache_key, data, { ex: PROJECT_LIST_CACHE_REFRESH_INTERVAL_MS / 1000 }),
      options.defer
    );
  }
  return data satisfies project_type[];
};

/** Cache laoder for `project_info` */
export const get_project_map_func = async (
  project_id: number,
  options: db_options
): Promise<recursive_list_type> => {
  const { db, redis } = options;
  const cache_key = REDIS_CACHE_KEYS_CLIENT.project_map(project_id);
  let cache = null;
  if (import.meta.env.PROD) {
    cache = await redis.get<recursive_list_type>(cache_key);
  }
  if (cache) return cache;

  const data = await db.query.projects.findFirst({
    where: (tbl, { eq }) => eq(tbl.id, project_id),
    columns: {
      id: true,
      map: true
    }
  });
  if (!data) throw new Error(`Project not found: ${project_id}`);
  const { map } = data;
  if (import.meta.env.PROD) {
    defer_promise(
      redis.set(cache_key, map, { ex: PROJECT_LIST_CACHE_REFRESH_INTERVAL_MS / 1000 }),
      options.defer
    );
  }
  return map satisfies recursive_list_type;
};
