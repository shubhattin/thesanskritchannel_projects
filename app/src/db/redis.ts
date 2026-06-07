import { env } from '$env/dynamic/private';
import { createRedis } from '@tsc/server-data/runtime';
import { REDIS_CACHE_KEYS_CLIENT } from './redis_shared';

export const REDIS_CACHE_KEYS = REDIS_CACHE_KEYS_CLIENT;
export const redis = createRedis(env);

type RedisEvalClient = Pick<typeof redis, 'eval'>;

const DELETE_KEYS_WITH_PATTERN_SCRIPT = `
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

const GET_KEYS_WITH_PATTERN_SCRIPT = `
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

export async function deleteKeysWithPatternForClient(
  redisClient: RedisEvalClient,
  pattern: string
) {
  return redisClient.eval(DELETE_KEYS_WITH_PATTERN_SCRIPT, [], [pattern]);
}

export async function getKeysWithPatternForClient(
  redisClient: RedisEvalClient,
  pattern: string
): Promise<string[]> {
  const keys = (await redisClient.eval(GET_KEYS_WITH_PATTERN_SCRIPT, [], [pattern])) as string[];
  return keys;
}

export async function deleteKeysWithPattern(pattern: string) {
  return deleteKeysWithPatternForClient(redis, pattern);
}

export async function getKeysWithPattern(pattern: string): Promise<string[]> {
  return getKeysWithPatternForClient(redis, pattern);
}
