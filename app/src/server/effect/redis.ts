import { Context, Effect, Layer } from 'effect';
import {
  deleteKeysWithPatternForClient,
  getKeysWithPatternForClient,
  redis,
  REDIS_CACHE_KEYS
} from '~/db/redis';
import { tryPromise } from './try-promise';
import type { AppServiceError } from './errors';

export { REDIS_CACHE_KEYS };

export class RedisService extends Context.Tag('RedisService')<
  RedisService,
  {
    readonly redis: typeof redis;
    readonly keys: typeof REDIS_CACHE_KEYS;
    readonly del: (...keys: string[]) => Effect.Effect<number, AppServiceError>;
    readonly get: <A>(key: string) => Effect.Effect<A | null, AppServiceError>;
    readonly set: <A>(
      key: string,
      value: A,
      options?: Parameters<typeof redis.set>[2]
    ) => Effect.Effect<unknown, AppServiceError>;
    readonly deleteKeysWithPattern: (pattern: string) => Effect.Effect<unknown, AppServiceError>;
    readonly getKeysWithPattern: (pattern: string) => Effect.Effect<string[], AppServiceError>;
  }
>() {}

export const RedisServiceLive = Layer.succeed(RedisService, {
  redis,
  keys: REDIS_CACHE_KEYS,
  del: (...keys: string[]) => tryPromise('redis.del', () => redis.del(...keys)),
  get: <A>(key: string) => tryPromise('redis.get', () => redis.get<A>(key)),
  set: <A>(key: string, value: A, options?: Parameters<typeof redis.set>[2]) =>
    tryPromise('redis.set', () => redis.set(key, value, options)),
  deleteKeysWithPattern: (pattern: string) =>
    tryPromise('redis.deleteKeysWithPattern', () => deleteKeysWithPatternForClient(redis, pattern)),
  getKeysWithPattern: (pattern: string) =>
    tryPromise('redis.getKeysWithPattern', () => getKeysWithPatternForClient(redis, pattern))
});

export const redis_del_effect = (...keys: string[]) =>
  Effect.flatMap(RedisService, (service) => service.del(...keys));

export const redis_get_effect = <A>(key: string) =>
  Effect.flatMap(RedisService, (service) => service.get<A>(key));

export const redis_set_effect = <A>(
  key: string,
  value: A,
  options?: Parameters<typeof redis.set>[2]
) => Effect.flatMap(RedisService, (service) => service.set(key, value, options));

export const delete_keys_with_pattern_effect = (pattern: string) =>
  Effect.flatMap(RedisService, (service) => service.deleteKeysWithPattern(pattern));

export const get_keys_with_pattern_effect = (pattern: string) =>
  Effect.flatMap(RedisService, (service) => service.getKeysWithPattern(pattern));
