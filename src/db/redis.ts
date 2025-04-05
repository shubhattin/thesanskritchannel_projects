import { env } from '$env/dynamic/private';
import { Redis } from '@upstash/redis/cloudflare';

export const redis = new Redis({
  url: env.UPSTASH_REDIS_REST_URL,
  token: env.UPSTASH_REDIS_REST_TOKEN
});

export const REDIS_CACHE_KEYS = {
  user_project_info: (user_id: string, project_id: number | '*') =>
    `user_project_info:${user_id}:${project_id}`,
  text_data: (project_id: number, path_params: (number | null)[]) =>
    `text_data:${project_id}:${path_params.join('.')}`,
  translation: (project_id: number, lang_id: number, path_params: (number | null)[]) =>
    `trans_data:${project_id}:${lang_id}:${path_params.join('.')}`,
  media_links: (project_id: number, path_params: (number | null)[]) =>
    `media_links:${project_id}:${path_params.join('.')}`
};

export async function deleteKeysWithPattern(pattern: string) {
  const script = `
      local cursor = "0"
      local deleted = 0
      repeat
        local result = redis.call("SCAN", cursor, "MATCH", ARGV[1], "COUNT", 100)
        cursor = result[1]
        local keys = result[2]
        if #keys > 0 then
          deleted = deleted + redis.call("DEL", unpack(keys))
        end
      until cursor == "0"
      return deleted
    `;

  return redis.eval(script, [], [pattern]);
}
