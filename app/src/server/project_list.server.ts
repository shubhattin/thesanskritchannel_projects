import ms from 'ms';
import { type recursive_list_type } from '../state/data_types';
import {
  build_project_registry,
  build_project_info,
  type project_info_type,
  type project_registry_type,
  type project_type
} from '../state/project_list';
import { type db_options, get_project_list_func, get_project_map_func } from './cached_loader';

export type defer_promise_type = (promise: Promise<unknown>) => void;
export type { project_type };

type internal_project_registry_type = project_registry_type & {
  getMapById: ReadonlyMap<number, () => Promise<recursive_list_type>>;
};

type project_lookup_options = {
  listed_only?: boolean;
};

const PROJECT_LIST_CACHE_REFRESH_INTERVAL_MS = ms('12hours');

type RegistryCache = {
  value: internal_project_registry_type | null;
  fetchedAt: number;
  inFlight: Promise<internal_project_registry_type> | null;
  /** Bumped on clear so in-flight fetches cannot write stale registry data. */
  generation: number;
};

const registry_cache: RegistryCache = {
  value: null,
  fetchedAt: 0,
  inFlight: null,
  generation: 0
};

type MapCacheEntry = {
  value: recursive_list_type | null;
  fetchedAt: number;
  inFlight: Promise<recursive_list_type> | null;
};

const map_cache = new Map<number, MapCacheEntry>();

/** Clears in-memory project map cache for one project or all projects. */
export const clear_project_map_cache = (project_id?: number) => {
  if (project_id === undefined) {
    map_cache.clear();
    return;
  }
  map_cache.delete(project_id);
};

/** Clears in-memory project registry cache (call after project metadata mutations). */
export const clear_project_registry_cache = () => {
  registry_cache.generation += 1;
  registry_cache.value = null;
  registry_cache.fetchedAt = 0;
  registry_cache.inFlight = null;
};

type ProjectInfoCacheEntry = {
  value: Promise<project_info_type>;
  fetchedAt: number;
};

const project_info_cache = new Map<string, ProjectInfoCacheEntry>();

/** Clears in-memory project info cache for one key or all keys. */
export const clear_project_info_cache = (project_key?: string) => {
  if (project_key === undefined) {
    project_info_cache.clear();
    return;
  }
  project_info_cache.delete(project_key);
};

/** Clears registry and project map in-memory caches. */
export const clear_project_server_cache = () => {
  clear_project_registry_cache();
  clear_project_map_cache();
  clear_project_info_cache();
};

const is_cache_fresh = (fetchedAt: number) =>
  Date.now() - fetchedAt < PROJECT_LIST_CACHE_REFRESH_INTERVAL_MS;

const get_internal_registry = async (
  options: db_options
): Promise<internal_project_registry_type> => {
  if (registry_cache.value && is_cache_fresh(registry_cache.fetchedAt)) {
    return registry_cache.value;
  }
  if (registry_cache.inFlight) return registry_cache.inFlight;

  const fetch_generation = registry_cache.generation;

  registry_cache.inFlight = Promise.resolve(
    (async (): Promise<internal_project_registry_type> => {
      const sorted_source = await get_project_list_func(options);
      const registry = build_project_registry(
        sorted_source.map(({ id, name, name_dev, description, key, listed }) => ({
          id,
          name,
          name_dev,
          description,
          key,
          listed
        }))
      );
      const getMapById = new Map(
        sorted_source.map(
          (project) => [project.id, () => get_project_map_func(project.id, options)] as const
        )
      );
      return { ...registry, getMapById };
    })()
  )
    .then((value) => {
      if (fetch_generation === registry_cache.generation) {
        registry_cache.value = value;
        registry_cache.fetchedAt = Date.now();
        registry_cache.inFlight = null;
      }
      return value;
    })
    .catch((err) => {
      if (fetch_generation === registry_cache.generation) {
        registry_cache.inFlight = null;
      }
      throw err;
    });

  return registry_cache.inFlight;
};

const get_filtered_registry = (
  registry: internal_project_registry_type,
  lookup_options?: project_lookup_options
): project_registry_type => {
  if (!lookup_options?.listed_only) {
    const { list, byId, byKey } = registry;
    return { list, byId, byKey };
  }
  return build_project_registry(registry.list.filter((project) => project.listed));
};

/** Cached public project metadata list (respects PROJECT_LIST_CACHE_REFRESH_INTERVAL_MS). */
export const get_project_list = async (
  options: db_options,
  lookup_options?: project_lookup_options
): Promise<readonly project_type[]> => {
  const registry = await get_internal_registry(options);
  return get_filtered_registry(registry, lookup_options).list;
};

/** Cached project registry with O(1) lookups by id and key. */
export const get_project_registry = async (
  options: db_options,
  lookup_options?: project_lookup_options
): Promise<project_registry_type> => {
  const registry = await get_internal_registry(options);
  return get_filtered_registry(registry, lookup_options);
};

export const get_project_by_id = async (
  id: number,
  options: db_options,
  lookup_options?: project_lookup_options
) => {
  const registry = await get_internal_registry(options);
  const project = registry.byId.get(id);
  if (lookup_options?.listed_only && project && !project.listed) return undefined;
  return project;
};

export const get_project_by_key = async (
  key: string,
  options: db_options,
  lookup_options?: project_lookup_options
) => {
  const registry = await get_internal_registry(options);
  const project = registry.byKey.get(key);
  if (lookup_options?.listed_only && project && !project.listed) return undefined;
  return project;
};

export const get_project_map_by_id = async (
  id: number,
  options: db_options
): Promise<recursive_list_type> => {
  const registry = await get_internal_registry(options);
  const project = registry.byId.get(id);
  if (!project) throw new Error(`Project not found: ${id}`);
  return get_project_map_by_key(project.key, options);
};

export const get_project_map_by_key = async (
  key: string,
  options: db_options
): Promise<recursive_list_type> => {
  const registry = await get_internal_registry(options);
  const project = registry.byKey.get(key);
  if (!project) throw new Error(`Project not found: ${key}`);

  const get_map = registry.getMapById.get(project.id);
  if (!get_map) throw new Error(`Project map loader not found: ${key}`);

  let entry = map_cache.get(project.id);
  if (!entry) {
    entry = { value: null, fetchedAt: 0, inFlight: null };
    map_cache.set(project.id, entry);
  }

  if (entry.value && is_cache_fresh(entry.fetchedAt)) {
    return entry.value;
  }
  if (entry.inFlight) return entry.inFlight;

  entry.inFlight = get_map()
    .then((value) => {
      entry!.value = value;
      entry!.fetchedAt = Date.now();
      entry!.inFlight = null;
      return value;
    })
    .catch((err) => {
      entry!.inFlight = null;
      throw err;
    });

  return entry.inFlight;
};

export const get_project_info_by_key = async (
  key: string,
  options: db_options
): Promise<project_info_type> => {
  const cached = project_info_cache.get(key);
  if (cached && is_cache_fresh(cached.fetchedAt)) return cached.value;
  if (cached) project_info_cache.delete(key);

  const promise = (async () => {
    const registry = await get_internal_registry(options);
    const project = registry.byKey.get(key);
    if (!project) throw new Error(`Project not found: ${key}`);
    const map = await get_project_map_by_key(key, options);
    return build_project_info(project, map);
  })();

  project_info_cache.set(key, { value: promise, fetchedAt: Date.now() });
  promise.catch(() => {
    if (project_info_cache.get(key)?.value === promise) {
      project_info_cache.delete(key);
    }
  });
  return promise;
};

export const get_project_info_by_id = async (
  id: number,
  options: db_options
): Promise<project_info_type> => {
  const registry = await get_internal_registry(options);
  const project = registry.byId.get(id);
  if (!project) throw new Error(`Project not found: ${id}`);
  return get_project_info_by_key(project.key, options);
};
