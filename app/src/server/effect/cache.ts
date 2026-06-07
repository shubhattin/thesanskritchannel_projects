import { Context, Effect, Layer } from 'effect';
import { create_cache_db_options_app } from '../cache/cache_db_options';
import type { db_options } from '../cache/cached_loader';

export class CacheService extends Context.Tag('CacheService')<
  CacheService,
  {
    readonly options: db_options;
  }
>() {}

export const CacheServiceLive = Layer.effect(
  CacheService,
  Effect.gen(function* () {
    const options = yield* Effect.promise(() => create_cache_db_options_app());
    return { options };
  })
);
