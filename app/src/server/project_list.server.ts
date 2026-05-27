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

const PROJECT_LIST_CACHE_REFRESH_INTERVAL_MS = ms('12hours');

type RegistryCache = {
  value: internal_project_registry_type | null;
  fetchedAt: number;
  inFlight: Promise<internal_project_registry_type> | null;
};

const registry_cache: RegistryCache = {
  value: null,
  fetchedAt: 0,
  inFlight: null
};

type MapCacheEntry = {
  value: recursive_list_type | null;
  fetchedAt: number;
  inFlight: Promise<recursive_list_type> | null;
};

const map_cache = new Map<number, MapCacheEntry>();

const is_cache_fresh = (fetchedAt: number) =>
  Date.now() - fetchedAt < PROJECT_LIST_CACHE_REFRESH_INTERVAL_MS;

const build_internal_registry = async (
  options: db_options
): Promise<internal_project_registry_type> => {
  const sorted_source = await get_project_list_func(options);
  const registry = build_project_registry(
    sorted_source.map(({ id, name, name_dev, description, key, listed }) => ({
      id,
      name,
      name_dev,
      description,
      key,
      listed
    })),
    { sort: false }
  );
  const getMapById = new Map(
    sorted_source.map(
      (project) => [project.id, () => get_project_map_func(project.id, options)] as const
    )
  );

  return {
    ...registry,
    getMapById
  };
};

const get_internal_registry = async (
  options: db_options
): Promise<internal_project_registry_type> => {
  if (registry_cache.value && is_cache_fresh(registry_cache.fetchedAt)) {
    return registry_cache.value;
  }
  if (registry_cache.inFlight) return registry_cache.inFlight;

  registry_cache.inFlight = Promise.resolve(build_internal_registry(options))
    .then((value) => {
      registry_cache.value = value;
      registry_cache.fetchedAt = Date.now();
      registry_cache.inFlight = null;
      return value;
    })
    .catch((err) => {
      registry_cache.inFlight = null;
      throw err;
    });

  return registry_cache.inFlight;
};

/** Cached public project metadata list (respects PROJECT_LIST_CACHE_REFRESH_INTERVAL_MS). */
export const get_project_list = async (options: db_options): Promise<readonly project_type[]> => {
  const registry = await get_internal_registry(options);
  return registry.list;
};

/** Cached project registry with O(1) lookups by id and key. */
export const get_project_registry = async (options: db_options): Promise<project_registry_type> => {
  const { list, byId, byKey } = await get_internal_registry(options);
  return { list, byId, byKey };
};

export const get_project_by_id = async (id: number, options: db_options) => {
  const registry = await get_internal_registry(options);
  return registry.byId.get(id);
};

export const get_project_by_key = async (key: string, options: db_options) => {
  const registry = await get_internal_registry(options);
  return registry.byKey.get(key);
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

type ProjectInfoCacheEntry = {
  value: Promise<project_info_type>;
  fetchedAt: number;
};

const project_info_cache = new Map<string, ProjectInfoCacheEntry>();

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
