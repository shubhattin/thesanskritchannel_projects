import { Context, Effect, Layer } from 'effect';
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
} from '../cache/project_list.server';
import { CacheService } from './cache';
import { tryPromise } from './try-promise';

export const get_project_list_effect = (lookupOptions?: Parameters<typeof get_project_list>[1]) =>
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

export const ProjectServiceLive = Layer.succeed(ProjectService, {
  getProjectList: get_project_list_effect,
  getProjectById: get_project_by_id_effect,
  getProjectByKey: get_project_by_key_effect,
  getProjectInfoById: get_project_info_by_id_effect,
  getProjectInfoByKey: get_project_info_by_key_effect,
  getProjectMapById: get_project_map_by_id_effect,
  getProjectMapByKey: get_project_map_by_key_effect,
  clearRegistryCache: () => Effect.sync(() => clear_project_registry_cache()),
  clearMapCache: (projectId?: number) =>
    Effect.sync(() => clear_server_project_map_cache(projectId)),
  clearInfoCache: (projectKey?: string) =>
    Effect.sync(() => clear_server_project_info_cache(projectKey))
});
