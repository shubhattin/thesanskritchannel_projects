import { Context, Data, Effect, Layer } from 'effect';
import { db } from '~/db/db';
import { redis, REDIS_CACHE_KEYS } from '~/db/redis';
import { cache_db_options_app } from '../cache_db_options';
import {
  clear_project_registry_cache,
  clear_server_project_info_cache,
  clear_server_project_map_cache,
  get_project_by_id,
  get_project_by_key,
  get_project_info_by_id,
  get_project_info_by_key,
  get_project_list,
  get_project_map_by_id,
  get_project_map_by_key
} from '../project_list.server';
import {
  get_site_lekha_data_func,
  get_site_lekha_list_func,
  get_text_data_func,
  get_translation_data_func
} from '../cached_loader';

export class AppServiceError extends Data.TaggedError('AppServiceError')<{
  operation: string;
  cause: unknown;
}> {}

const tryPromise = <A>(operation: string, run: () => Promise<A>) =>
  Effect.tryPromise({
    try: run,
    catch: (cause) => new AppServiceError({ operation, cause })
  });

export class ConfigService extends Context.Tag('ConfigService')<
  ConfigService,
  {
    readonly isProd: boolean;
    readonly isDev: boolean;
  }
>() {}

export const ConfigServiceLive = Layer.succeed(ConfigService, {
  isProd: import.meta.env.PROD,
  isDev: import.meta.env.DEV
});

export class DbService extends Context.Tag('DbService')<
  DbService,
  {
    readonly db: typeof db;
    readonly transaction: typeof db.transaction;
  }
>() {}

export const DbServiceLive = Layer.succeed(DbService, {
  db,
  transaction: db.transaction.bind(db)
});

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
  }
>() {}

export const RedisServiceLive = Layer.succeed(RedisService, {
  redis,
  keys: REDIS_CACHE_KEYS,
  del: (...keys: string[]) => tryPromise('redis.del', () => redis.del(...keys)),
  get: <A>(key: string) => tryPromise('redis.get', () => redis.get<A>(key)),
  set: <A>(key: string, value: A, options?: Parameters<typeof redis.set>[2]) =>
    tryPromise('redis.set', () => redis.set(key, value, options))
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

export class CacheService extends Context.Tag('CacheService')<
  CacheService,
  {
    readonly options: typeof cache_db_options_app;
  }
>() {}

export const CacheServiceLive = Layer.succeed(CacheService, {
  options: cache_db_options_app
});

export class ProjectService extends Context.Tag('ProjectService')<
  ProjectService,
  {
    readonly getProjectList: typeof get_project_list_effect;
    readonly getProjectById: typeof get_project_by_id_effect;
    readonly getProjectByKey: typeof get_project_by_key_effect;
    readonly getProjectInfoById: typeof get_project_info_by_id_effect;
    readonly getProjectInfoByKey: typeof get_project_info_by_key_effect;
    readonly getProjectMapById: typeof get_project_map_by_id_effect;
    readonly getProjectMapByKey: typeof get_project_map_by_key_effect;
    readonly clearRegistryCache: () => Effect.Effect<void>;
    readonly clearMapCache: (projectId?: number) => Effect.Effect<void>;
    readonly clearInfoCache: (projectKey?: string) => Effect.Effect<void>;
  }
>() {}

export const get_project_list_effect = (
  lookupOptions?: Parameters<typeof get_project_list>[1]
) =>
  Effect.flatMap(CacheService, ({ options }) =>
    tryPromise('project.getProjectList', () => get_project_list(options, lookupOptions))
  );

export const get_project_by_id_effect = (
  id: number,
  lookupOptions?: Parameters<typeof get_project_by_id>[2]
) =>
  Effect.flatMap(CacheService, ({ options }) =>
    tryPromise('project.getProjectById', () => get_project_by_id(id, options, lookupOptions))
  );

export const get_project_by_key_effect = (
  key: string,
  lookupOptions?: Parameters<typeof get_project_by_key>[2]
) =>
  Effect.flatMap(CacheService, ({ options }) =>
    tryPromise('project.getProjectByKey', () => get_project_by_key(key, options, lookupOptions))
  );

export const get_project_info_by_id_effect = (id: number) =>
  Effect.flatMap(CacheService, ({ options }) =>
    tryPromise('project.getProjectInfoById', () => get_project_info_by_id(id, options))
  );

export const get_project_info_by_key_effect = (key: string) =>
  Effect.flatMap(CacheService, ({ options }) =>
    tryPromise('project.getProjectInfoByKey', () => get_project_info_by_key(key, options))
  );

export const get_project_map_by_id_effect = (id: number) =>
  Effect.flatMap(CacheService, ({ options }) =>
    tryPromise('project.getProjectMapById', () => get_project_map_by_id(id, options))
  );

export const get_project_map_by_key_effect = (key: string) =>
  Effect.flatMap(CacheService, ({ options }) =>
    tryPromise('project.getProjectMapByKey', () => get_project_map_by_key(key, options))
  );

export const ProjectServiceLive = Layer.succeed(ProjectService, {
  getProjectList: get_project_list_effect,
  getProjectById: get_project_by_id_effect,
  getProjectByKey: get_project_by_key_effect,
  getProjectInfoById: get_project_info_by_id_effect,
  getProjectInfoByKey: get_project_info_by_key_effect,
  getProjectMapById: get_project_map_by_id_effect,
  getProjectMapByKey: get_project_map_by_key_effect,
  clearRegistryCache: () => Effect.sync(clear_project_registry_cache),
  clearMapCache: (projectId?: number) => Effect.sync(() => clear_server_project_map_cache(projectId)),
  clearInfoCache: (projectKey?: string) =>
    Effect.sync(() => clear_server_project_info_cache(projectKey))
});

export class LoaderService extends Context.Tag('LoaderService')<
  LoaderService,
  {
    readonly getTextData: typeof get_text_data_effect;
    readonly getTranslationData: typeof get_translation_data_effect;
    readonly getSiteLekhaData: typeof get_site_lekha_data_effect;
    readonly getSiteLekhaList: typeof get_site_lekha_list_effect;
  }
>() {}

export const get_text_data_effect = (key: string, pathParams: number[]) =>
  Effect.flatMap(CacheService, ({ options }) =>
    tryPromise('loader.getTextData', () => get_text_data_func(key, pathParams, options))
  );

export const get_translation_data_effect = (
  projectId: number,
  langId: number,
  selectedTextLevels: (number | null)[]
) =>
  Effect.flatMap(CacheService, ({ options }) =>
    tryPromise('loader.getTranslationData', () =>
      get_translation_data_func(projectId, langId, selectedTextLevels, options)
    )
  );

export const get_site_lekha_data_effect = (urlSlug: string) =>
  Effect.flatMap(CacheService, ({ options }) =>
    tryPromise('loader.getSiteLekhaData', () => get_site_lekha_data_func(urlSlug, options))
  );

export const get_site_lekha_list_effect = () =>
  Effect.flatMap(CacheService, ({ options }) =>
    tryPromise('loader.getSiteLekhaList', () => get_site_lekha_list_func(options))
  );

export const LoaderServiceLive = Layer.succeed(LoaderService, {
  getTextData: get_text_data_effect,
  getTranslationData: get_translation_data_effect,
  getSiteLekhaData: get_site_lekha_data_effect,
  getSiteLekhaList: get_site_lekha_list_effect
});

export const AppLive = Layer.mergeAll(
  ConfigServiceLive,
  DbServiceLive,
  RedisServiceLive,
  CacheServiceLive,
  ProjectServiceLive,
  LoaderServiceLive
);

export const runAppEffect = <A, E>(program: Effect.Effect<A, E, any>): Promise<A> =>
  Effect.runPromise(program.pipe(Effect.provide(AppLive)) as Effect.Effect<A, E, never>);
