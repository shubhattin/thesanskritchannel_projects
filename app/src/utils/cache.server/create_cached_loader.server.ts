import ms from 'ms';
import type { ZodType } from 'zod';
import { waitUntil } from '@vercel/functions';
import type { db_options, defer_promise_type } from './cache_db_options.server';

const DEFAULT_TTL_S = ms('30days') / 1000;

const defer_promise = (promise: Promise<unknown>, defer?: defer_promise_type) => {
  const defer_func = defer ?? waitUntil;
  defer_func(promise);
  void promise.catch(() => {});
};

export type CachedLoaderFn<TParams, TData> = (
  params: TParams,
  options: db_options
) => Promise<TData>;

export type CachedLoaderRefreshOptions = {
  /** Delete the redis key before fetching fresh data. Default true. */
  deleteFirst?: boolean;
};

export type CachedLoader<TParams, TData> = CachedLoaderFn<TParams, TData> & {
  get: CachedLoaderFn<TParams, TData>;
  delete: (params: TParams, options: db_options) => Promise<void>;
  refresh: (
    params: TParams,
    options: db_options,
    opts?: CachedLoaderRefreshOptions
  ) => Promise<TData>;
  key: (params: TParams, options: db_options) => Promise<string>;
};

export type CreateCachedLoaderConfig<TParams, TCached, TData = TCached> = {
  getKey: (params: TParams, options: db_options) => string | Promise<string>;
  fetch: (params: TParams, options: db_options) => Promise<TCached>;
  /** Parsed on cache hit (e.g. coerce timestamp strings to Date). */
  schema?: ZodType<TCached>;
  /** Applied after read from cache or DB (e.g. array → Map). */
  transform?: (data: TCached) => TData;
  ttlSeconds?: number;
  /** Skip redis.set when false (e.g. null lookup results). */
  shouldCache?: (data: TCached) => boolean;
};

const to_return_value = <TCached, TData>(
  data: TCached,
  transform?: (data: TCached) => TData
): TData => (transform ? transform(data) : (data as unknown as TData));

export function createCachedLoader<TParams, TCached, TData = TCached>(
  config: CreateCachedLoaderConfig<TParams, TCached, TData>
): CachedLoader<TParams, TData> {
  const ttlSeconds = config.ttlSeconds ?? DEFAULT_TTL_S;
  const shouldCache = config.shouldCache ?? (() => true);

  const resolve_key = (params: TParams, options: db_options) =>
    Promise.resolve(config.getKey(params, options));

  const get: CachedLoaderFn<TParams, TData> = async (params, options) => {
    const { redis } = options;
    const cache_key = await resolve_key(params, options);

    if (import.meta.env.PROD) {
      const cached = await redis.get<TCached>(cache_key);
      if (cached !== null && cached !== undefined) {
        const parsed = config.schema ? config.schema.parse(cached) : cached;
        return to_return_value(parsed, config.transform);
      }
    }

    const fetched = await config.fetch(params, options);

    if (import.meta.env.PROD && shouldCache(fetched)) {
      defer_promise(redis.set(cache_key, fetched, { ex: ttlSeconds }), options.defer);
    }

    return to_return_value(fetched, config.transform);
  };

  const delete_cache = async (params: TParams, options: db_options) => {
    const cache_key = await resolve_key(params, options);
    await options.redis.del(cache_key);
  };

  const refresh = async (
    params: TParams,
    options: db_options,
    { deleteFirst = true }: CachedLoaderRefreshOptions = {}
  ) => {
    const { redis } = options;
    const cache_key = await resolve_key(params, options);

    const [, fetched] = await Promise.all([
      deleteFirst ? redis.del(cache_key) : Promise.resolve(),
      config.fetch(params, options)
    ]);

    if (import.meta.env.PROD && shouldCache(fetched)) {
      await redis.set(cache_key, fetched, { ex: ttlSeconds });
    }

    return to_return_value(fetched, config.transform);
  };

  const loader = Object.assign(get, {
    get,
    delete: delete_cache,
    refresh,
    key: resolve_key
  });

  return loader;
}

/** No-arg cache loaders use an empty params object. */
export type NoCacheParams = Record<string, never>;

export const NO_CACHE_PARAMS = {} as NoCacheParams;
