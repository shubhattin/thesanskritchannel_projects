import { Pool } from '@neondatabase/serverless';
import { Redis } from '@upstash/redis';
import { drizzle as drizzle_neon } from 'drizzle-orm/neon-serverless';
import ms from 'ms';
import { resolve } from 'node:path';
import postgres from 'postgres';
import { fileURLToPath } from 'node:url';
import { drizzle as drizzle_postgres } from 'drizzle-orm/postgres-js';
import * as schema from '../db/schema';
import { get_db_url } from '../db/db_utils';
import { REDIS_CACHE_KEYS_CLIENT } from '../db/redis_shared';
import type { shloka_list_type } from '../state/data_types';
import { get_project_from_key, type project_keys_type } from '../state/project_list';

export type defer_promise_type = (promise: Promise<unknown>) => void;

const get_text_data_loc = (project_id: number, key: string, path_params: number[]) =>
  `data/${project_id}. ${key}/data` +
  (path_params.length !== 0 ? `/${path_params.join('/')}.json` : `.json`);

const repo_root = resolve(fileURLToPath(new URL('.', import.meta.url)), '../..');
const get_text_data_file_path = (project_id: number, key: string, path_params: number[]) =>
  resolve(repo_root, get_text_data_loc(project_id, key, path_params));

let db_promise: Promise<any> | null = null;
const get_db = async () => {
  if (!db_promise) {
    db_promise = (async () => {
      const DB_URL = get_db_url(process.env);
      if (import.meta.env.DEV) {
        return drizzle_postgres(postgres(DB_URL), { schema });
      }
      return drizzle_neon(new Pool({ connectionString: DB_URL }), { schema });
    })();
  }
  return db_promise;
};

let redis_instance: Redis | null = null;
const get_redis = () => {
  if (!redis_instance) {
    redis_instance = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN
    });
  }
  return redis_instance;
};

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
  options?: { defer?: defer_promise_type }
) => {
  const project_id = get_project_from_key(key as project_keys_type).id;
  if (import.meta.env.DEV) {
    const fs = await import('node:fs');
    return JSON.parse(
      fs.readFileSync(get_text_data_file_path(project_id, key, path_params), 'utf8')
    ) as shloka_list_type;
  }

  const redis = get_redis();
  const cache_key = REDIS_CACHE_KEYS_CLIENT.text_data(project_id, path_params);
  const cache = await redis.get<shloka_list_type>(cache_key);
  if (cache) return cache;

  const db = await get_db();
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
    options?.defer
  );

  return data as shloka_list_type;
};
