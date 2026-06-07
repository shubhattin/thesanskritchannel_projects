import { Context, Layer } from 'effect';
import { cache_db_options_app } from '../cache/cache_db_options';

export class CacheService extends Context.Tag('CacheService')<
  CacheService,
  {
    readonly options: typeof cache_db_options_app;
  }
>() {}

export const CacheServiceLive = Layer.succeed(CacheService, {
  options: cache_db_options_app
});
