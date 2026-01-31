import { z } from 'zod';
import { publicProcedure, t } from '~/api/trpc_init';
import { db } from '~/db/db';
import type { shloka_list_type } from '~/state/data_types';
import { delay } from '~/tools/delay';
import { redis, REDIS_CACHE_KEYS } from '~/db/redis';
import { get_project_from_key, type project_keys_type } from '~/state/project_list';
import ms from 'ms';
import { waitUntil } from '@vercel/functions';

/** first and second here are like the ones in url */
export const get_text_data_func = async (key: string, path_params: number[]) => {
  // Add Caching to load in PROD
  const project_id = get_project_from_key(key as project_keys_type).id;
  const loc =
    `data/${project_id}. ${key}/data` +
    (path_params.length !== 0 ? `/${path_params.join('/')}.json` : `.json`);
  if (import.meta.env.DEV) {
    // on DEV use local files directly
    // changes on local will be synced to the db and redis in PROD
    const fs = await import('fs');
    return JSON.parse(fs.readFileSync('./' + loc, 'utf8')) as shloka_list_type;
  }

  const cache = await redis.get<shloka_list_type>(
    REDIS_CACHE_KEYS.text_data(project_id, path_params)
  );
  if (cache) return cache;
  const data = await db.query.texts.findMany({
    columns: {
      text: true,
      index: true,
      shloka_num: true
    },
    where: (tbl, { eq, and }) =>
      and(eq(tbl.project_id, project_id), eq(tbl.path, path_params.join(':')))
  });
  // set cache in background and return data immediately
  waitUntil(
    redis.set(REDIS_CACHE_KEYS.text_data(project_id, path_params), data, {
      ex: ms('30days') / 1000
    })
  );
  return data;
};

const get_text_data_route = publicProcedure
  .input(
    z.object({
      project_key: z.string(),
      path_params: z.number().int().array()
    })
  )
  .query(async ({ input: { project_key, path_params } }) => {
    await delay(350);
    const data = await get_text_data_func(project_key, path_params);
    return data;
  });

const DEFAULT_PAGE_LIMIT = 500;
export const search_text_in_texts_route = publicProcedure
  .input(
    z.object({
      project_key: z.string().optional(),
      path_params: z.number().int().array().optional(),
      search_text: z.string().min(3).max(500),
      limit: z.number().int().min(1).max(100).default(DEFAULT_PAGE_LIMIT),
      offset: z.number().int().min(0).default(0)
    })
  )
  .query(async ({ input: { project_key, search_text, path_params, limit, offset } }) => {
    const data = await db.query.texts.findMany({
      where: (tbl, { and, eq, ilike }) => {
        const conditions = [ilike(tbl.text, `%${search_text}%`)];
        if (project_key) {
          const project_id = get_project_from_key(project_key as project_keys_type).id;
          conditions.push(eq(tbl.project_id, project_id));
        }
        if (typeof path_params !== 'undefined') {
          conditions.push(eq(tbl.path, path_params.join(':')));
        }
        return and(...conditions);
      },
      orderBy: (tbl, { asc }) => [asc(tbl.project_id), asc(tbl.path), asc(tbl.index)],
      limit: limit + 1,
      offset
    });
    const hasMore = data.length > limit;
    const items = hasMore ? data.slice(0, limit) : data;
    return {
      items,
      page: {
        limit,
        offset,
        nextOffset: hasMore ? offset + limit : null,
        hasMore
      }
    };
  });

export const text_router = t.router({
  get_text_data: get_text_data_route,
  search_text_in_texts: search_text_in_texts_route
});
