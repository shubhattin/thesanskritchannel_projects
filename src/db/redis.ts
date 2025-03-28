import { env } from '$env/dynamic/private';
import { Redis } from '@upstash/redis/cloudflare';

export const redis = new Redis({
  url: env.UPSTASH_REDIS_REST_URL,
  token: env.UPSTASH_REDIS_REST_TOKEN
});

export const REDIS_CACHE_KEYS = {
  text_data: (project_id: number, path_params: (number | null)[]) =>
    `text_data:${project_id}:${path_params.join('.')}`,
  translation: (project_id: number, lang_id: number, path_params: (number | null)[]) =>
    `trans_data:${project_id}:${lang_id}:${path_params.join('.')}`
};
