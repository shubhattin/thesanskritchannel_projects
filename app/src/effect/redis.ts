import { Context, Effect, Layer, Redacted } from 'effect';
import { Redis, type SetCommandOptions } from '@upstash/redis';
import { SharedConfig } from './config';
import { RedisError } from './errors';

/** JSON value as stored / read over the Upstash REST wire format. */
export type RedisJsonValue =
  | string
  | number
  | boolean
  | null
  | RedisJsonValue[]
  | { [key: string]: RedisJsonValue };

const tryRedis = <A>(operation: string, run: () => Promise<A>) =>
  Effect.tryPromise({
    try: run,
    catch: (cause) => RedisError.make({ operation, cause })
  }).pipe(Effect.annotateLogs({ category: 'cache', operation }));

const DELETE_KEYS_WITH_PATTERN = `
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

const GET_KEYS_WITH_PATTERN = `
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

export class RedisClient extends Context.Service<
  RedisClient,
  {
    readonly get: <T = unknown>(key: string) => Effect.Effect<T | null, RedisError>;
    readonly set: (
      key: string,
      value: RedisJsonValue,
      options?: SetCommandOptions
    ) => Effect.Effect<unknown, RedisError>;
    readonly del: (...keys: string[]) => Effect.Effect<number, RedisError>;
    readonly incr: (key: string) => Effect.Effect<number, RedisError>;
    readonly eval: (
      script: string,
      keys: string[],
      args: (string | number)[]
    ) => Effect.Effect<unknown, RedisError>;
    readonly deleteKeysWithPattern: (pattern: string) => Effect.Effect<number, RedisError>;
    readonly getKeysWithPattern: (pattern: string) => Effect.Effect<string[], RedisError>;
  }
>()('RedisClient') {
  static readonly Live = Layer.effect(RedisClient)(
    Effect.gen(function* () {
      const config = yield* SharedConfig;
      // Upstash REST — safe to construct per layer build (no TCP connection pool).
      const redis = new Redis({
        url: config.upstashRedisUrl,
        token: Redacted.value(config.upstashRedisToken)
      });

      return {
        get: <T = unknown>(key: string) => tryRedis('get', () => redis.get<T>(key)),
        set: (key: string, value: RedisJsonValue, options?: SetCommandOptions) =>
          tryRedis('set', () => (options ? redis.set(key, value, options) : redis.set(key, value))),
        del: (...keys: string[]) => tryRedis('del', () => redis.del(...keys)),
        incr: (key: string) => tryRedis('incr', () => redis.incr(key)),
        eval: (script: string, keys: string[], args: (string | number)[]) =>
          tryRedis('eval', () => redis.eval(script, keys, args)),
        deleteKeysWithPattern: (pattern: string) =>
          tryRedis('deleteKeysWithPattern', async () => {
            const deleted = await redis.eval(DELETE_KEYS_WITH_PATTERN, [], [pattern]);
            // Number() is the identity on numbers and the same fallback the typeof branch applied.
            return Number(deleted);
          }),
        getKeysWithPattern: (pattern: string) =>
          tryRedis('getKeysWithPattern', async () => {
            const keys = await redis.eval(GET_KEYS_WITH_PATTERN, [], [pattern]);
            if (!Array.isArray(keys)) return [];
            return keys.filter((key): key is string => typeof key === 'string');
          })
      };
    })
  );
}
