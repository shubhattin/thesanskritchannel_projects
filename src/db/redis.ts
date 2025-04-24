import { env } from '$env/dynamic/private';
import { Redis } from '@upstash/redis/cloudflare';

export const redis = new Redis({
  url: env.UPSTASH_REDIS_REST_URL,
  token: env.UPSTASH_REDIS_REST_TOKEN
});
export { REDIS_CACHE_KEYS } from './redis_shared';

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

export async function getKeysWithPattern(pattern: string): Promise<string[]> {
  const script = `
    local cursor = "0"
    local matched = {}
    repeat
      local result = redis.call("SCAN", cursor, "MATCH", ARGV[1], "COUNT", 100)
      cursor = result[1]
      local keys = result[2]
      for _, key in ipairs(keys) do
        table.insert(matched, key)
      end
    until cursor == "0"
    return matched
  `;

  const keys = (await redis.eval(script, [], [pattern])) as string[];
  return keys;
}
