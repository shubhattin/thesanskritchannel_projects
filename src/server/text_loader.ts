import ms from 'ms';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as schema from '../db/schema';
import { REDIS_CACHE_KEYS_CLIENT } from '../db/redis_shared';
import type { shloka_list_type } from '../state/data_types';
import {
  get_path_params,
  get_project_from_key,
  get_project_info_from_id,
  type project_keys_type
} from '../state/project_list';
import { REDIS_CACHE_KEYS } from '~/db/redis';
import type { Redis } from '@upstash/redis/cloudflare';

export type defer_promise_type = (promise: Promise<unknown>) => void;

const get_text_data_loc = (project_id: number, key: string, path_params: number[]) =>
  `data/${project_id}. ${key}/data` +
  (path_params.length !== 0 ? `/${path_params.join('/')}.json` : `.json`);

const repo_root = resolve(fileURLToPath(new URL('.', import.meta.url)), '../..');
const get_text_data_file_path = (project_id: number, key: string, path_params: number[]) =>
  resolve(repo_root, get_text_data_loc(project_id, key, path_params));

const defer_promise = (promise: Promise<unknown>, defer?: defer_promise_type) => {
  if (defer) {
    defer(promise);
    return;
  }
  void promise.catch(() => {});
};

export const get_text_data_func = async (
  key: string,
  path_params: number[],
  options: { defer?: defer_promise_type; db: any; redis: Redis }
) => {
  const { db, redis } = options;

  const project_id = get_project_from_key(key as project_keys_type).id;
  if (import.meta.env.DEV) {
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
    where: (tbl: typeof schema.texts, { eq, and }: { eq: any; and: any }) =>
      and(eq(tbl.project_id, project_id), eq(tbl.path, path_params.join(':'))),
    orderBy: ({ index }: typeof schema.texts, { asc }: { asc: any }) => asc(index)
  });

  defer_promise(
    redis.set(cache_key, data, {
      ex: ms('30days') / 1000
    }),
    options.defer
  );

  return data as shloka_list_type;
};

// export const get_translation_func = async (
//   project_id: number,
//   lang_id: number,
//   selected_text_levels: (number | null)[]
// ) => {
//   let data: {
//     index: number;
//     text: string;
//   }[] = [];
//   const redis = get_redis();

//   const { levels } = await get_project_info_from_id(project_id);
//   const path_params = get_path_params(selected_text_levels, levels);
//   const path = path_params.join(':');
//   let cache = null;
//   if (import.meta.env.PROD) {
//     cache = await redis.get<typeof data>(
//       REDIS_CACHE_KEYS.translation(project_id, lang_id, path_params)
//     );
//   }
//   if (cache) data = cache;
//   else {
//     const db = await get_db();
//     // data = await db.query.translations.findMany({
//     //   columns: {
//     //     index: true,
//     //     text: true
//     //   },
//     //   where: (tbl, { eq, and }) =>
//     //     and(eq(tbl.project_id, project_id), eq(tbl.lang_id, lang_id), eq(tbl.path, path)),
//     //   orderBy: ({ index }, { asc }) => asc(index)
//     // });
//     if (import.meta.env.PROD) {
//       // set cache in background
//       defer_promise(
//         redis.set(REDIS_CACHE_KEYS.translation(project_id, lang_id, path_params), data, {
//           ex: ms('30days') / 1000
//         })
//       );
//     }
//   }
//   const data_map = new Map<number, string>();
//   for (let i = 0; i < data.length; i++) data_map.set(data[i].index, data[i].text);
//   return data_map;
// };
