import { Effect } from 'effect';
import ms from 'ms';
import { z } from 'zod';
import type { recursive_list_type } from '~/state/data_types';
import { recursive_list_schema } from '~/state/data_types';
import {
  build_project_info,
  build_project_registry,
  type project_info_type,
  type project_registry_type,
  type project_type
} from '~/state/project_list';
import { REDIS_CACHE_KEYS_CLIENT } from '~/db/redis_shared';
import { createCache, NO_CACHE_PARAMS, type NoCacheParams } from './cache';
import { BackgroundWork } from './background';
import { SharedConfig } from './config';
import { Database, dbRun } from './database';
import { CacheError, NotFoundError } from './errors';
import { RedisClient } from './redis';

/** Same env as createCache — site-safe (no AiProvider / ObjectStorage). */
type ProjectCacheEnv = RedisClient | BackgroundWork | SharedConfig | Database;

const projectTypeSchema = z.object({
  id: z.number(),
  name: z.string(),
  name_dev: z.string(),
  description: z.string().nullable().optional(),
  key: z.string(),
  listed: z.boolean()
});

export type ProjectLookupOptions = {
  listed_only?: boolean;
};

export type ResolvedProjectByKey = {
  project: project_type;
  /** Key from the request URL (may be an old redirect key). */
  requested_key: string;
  /** True when `requested_key` was resolved via `project_redirects`. */
  was_redirect: boolean;
};

const PROJECT_LIST_CACHE_REFRESH_INTERVAL_MS = ms('12hours');

const toCacheError = (operation: string) => (cause: unknown) =>
  cause instanceof CacheError ? cause : CacheError.make({ operation, key: undefined, cause });

export const projectListCache = createCache<NoCacheParams, project_type[]>({
  getKey: () => REDIS_CACHE_KEYS_CLIENT.project_list(),
  schema: projectTypeSchema.array(),
  fetch: Effect.fn('project_list.fetch')(function* (_params) {
    return yield* dbRun('project_list.fetch', (db) =>
      db.query.projects.findMany({
        columns: {
          id: true,
          name: true,
          name_dev: true,
          description: true,
          key: true,
          listed: true
        },
        orderBy: ({ id }, { asc }) => asc(id)
      })
    ).pipe(Effect.mapError(toCacheError('project_list.fetch')));
  })
});

export const projectMapCache = createCache<{ project_id: number }, recursive_list_type>({
  getKey: ({ project_id }) => REDIS_CACHE_KEYS_CLIENT.project_map(project_id),
  schema: recursive_list_schema,
  fetch: Effect.fn('project_map.fetch')(function* ({ project_id }) {
    const data = yield* dbRun('project_map.fetch', (db) =>
      db.query.projects.findFirst({
        where: (tbl, { eq }) => eq(tbl.id, project_id),
        columns: {
          id: true,
          map: true
        }
      })
    ).pipe(Effect.mapError(toCacheError('project_map.fetch')));
    if (!data) {
      return yield* Effect.fail(
        CacheError.make({
          operation: 'project_map.fetch',
          cause: new Error(`Project not found: ${project_id}`)
        })
      );
    }
    return data.map;
  })
});

type ProjectMapEffect = ReturnType<typeof projectMapCache.get>;

type InternalProjectRegistry = project_registry_type & {
  getMapById: ReadonlyMap<number, () => ProjectMapEffect>;
};

type RegistryCache = {
  value: InternalProjectRegistry | null;
  fetchedAt: number;
  inFlight: Effect.Effect<InternalProjectRegistry, CacheError, ProjectCacheEnv> | null;
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
  inFlight: Effect.Effect<recursive_list_type, CacheError, ProjectCacheEnv> | null;
};

const map_cache = new Map<number, MapCacheEntry>();

type ProjectInfoEffect = Effect.Effect<
  project_info_type,
  CacheError | NotFoundError,
  ProjectCacheEnv
>;

/** Mutable holder so error cleanup can compare against the currently cached effect. */
type ProjectInfoEffectHolder = { current: ProjectInfoEffect | null };

type ProjectInfoCacheEntry = {
  value: ProjectInfoEffect | null;
  fetchedAt: number;
};

const project_info_cache = new Map<string, ProjectInfoCacheEntry>();

/** Clears in-memory project map cache for one project or all projects. */
export const clearServerProjectMapCache = (project_id?: number) => {
  if (project_id === undefined) {
    map_cache.clear();
    return;
  }
  map_cache.delete(project_id);
};

/** Clears in-memory project registry cache (call after project metadata mutations). */
export const clearProjectRegistryCache = () => {
  registry_cache.generation += 1;
  registry_cache.value = null;
  registry_cache.fetchedAt = 0;
  registry_cache.inFlight = null;
};

/** Clears in-memory project info cache for one key or all keys. */
export const clearServerProjectInfoCache = (project_key?: string) => {
  if (project_key === undefined) {
    project_info_cache.clear();
    return;
  }
  project_info_cache.delete(project_key);
};

/** @deprecated Prefer camelCase exports. */
export const clear_server_project_map_cache = clearServerProjectMapCache;
/** @deprecated Prefer camelCase exports. */
export const clear_project_registry_cache = clearProjectRegistryCache;
/** @deprecated Prefer camelCase exports. */
export const clear_server_project_info_cache = clearServerProjectInfoCache;

const is_cache_fresh = (fetchedAt: number) =>
  Date.now() - fetchedAt < PROJECT_LIST_CACHE_REFRESH_INTERVAL_MS;

const getInternalRegistry = Effect.fn('getInternalRegistry')(function* () {
  if (registry_cache.value && is_cache_fresh(registry_cache.fetchedAt)) {
    return registry_cache.value;
  }
  if (registry_cache.inFlight) {
    return yield* registry_cache.inFlight;
  }

  const fetch_generation = registry_cache.generation;

  const fetchEffect = yield* Effect.cached(
    Effect.gen(function* () {
      const sorted_source = yield* projectListCache.get(NO_CACHE_PARAMS);
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
        sorted_source.map((project) => [
          project.id,
          () => projectMapCache.get({ project_id: project.id })
        ])
      );
      return { ...registry, getMapById };
    }).pipe(
      Effect.tap((value) =>
        Effect.sync(() => {
          if (fetch_generation === registry_cache.generation) {
            registry_cache.value = value;
            registry_cache.fetchedAt = Date.now();
            registry_cache.inFlight = null;
          }
        })
      ),
      Effect.tapError(() =>
        Effect.sync(() => {
          if (fetch_generation === registry_cache.generation) {
            registry_cache.inFlight = null;
          }
        })
      )
    )
  );

  registry_cache.inFlight = fetchEffect;
  return yield* fetchEffect;
});

const getFilteredRegistry = (
  registry: InternalProjectRegistry,
  lookup_options?: ProjectLookupOptions
): project_registry_type => {
  if (!lookup_options?.listed_only) {
    const { list, byId, byKey } = registry;
    return { list, byId, byKey };
  }
  return build_project_registry(registry.list.filter((project) => project.listed));
};

/** Cached public project metadata list (respects PROJECT_LIST_CACHE_REFRESH_INTERVAL_MS). */
export const getProjectList = Effect.fn('getProjectList')(function* (
  lookup_options?: ProjectLookupOptions
) {
  const registry = yield* getInternalRegistry();
  return getFilteredRegistry(registry, lookup_options).list;
});

/** Cached project registry with O(1) lookups by id and key. */
export const getProjectRegistry = Effect.fn('getProjectRegistry')(function* (
  lookup_options?: ProjectLookupOptions
) {
  const registry = yield* getInternalRegistry();
  return getFilteredRegistry(registry, lookup_options);
});

export const getProjectById = Effect.fn('getProjectById')(function* (
  id: number,
  lookup_options?: ProjectLookupOptions
) {
  const registry = yield* getInternalRegistry();
  const project = registry.byId.get(id);
  if (lookup_options?.listed_only && project && !project.listed) return undefined;
  return project;
});

export const getProjectByKey = Effect.fn('getProjectByKey')(function* (
  key: string,
  lookup_options?: ProjectLookupOptions
) {
  const registry = yield* getInternalRegistry();
  const project = registry.byKey.get(key);
  if (lookup_options?.listed_only && project && !project.listed) return undefined;
  return project;
});

/**
 * Resolves a URL key to a project. Active project keys always win over redirect rules.
 * Falls back to `project_redirects` when the key is not a live project key.
 */
export const resolveProjectByKey = Effect.fn('resolveProjectByKey')(function* (
  key: string,
  lookup_options?: ProjectLookupOptions
) {
  const direct = yield* getProjectByKey(key, lookup_options);
  if (direct) {
    return {
      project: direct,
      requested_key: key,
      was_redirect: false
    } satisfies ResolvedProjectByKey;
  }

  const redirect = yield* dbRun('resolveProjectByKey.redirect', (db) =>
    db.query.project_redirects.findFirst({
      where: (tbl, { eq: eqKey }) => eqKey(tbl.key, key),
      columns: { project_id: true }
    })
  ).pipe(Effect.mapError(toCacheError('resolveProjectByKey.redirect')));

  if (!redirect) return undefined;

  const project = yield* getProjectById(redirect.project_id, lookup_options);
  if (!project) return undefined;

  return {
    project,
    requested_key: key,
    was_redirect: true
  } satisfies ResolvedProjectByKey;
});

export const getProjectMapByKey = Effect.fn('getProjectMapByKey')(function* (key: string) {
  const registry = yield* getInternalRegistry();
  const project = registry.byKey.get(key);
  if (!project) {
    return yield* Effect.fail(
      NotFoundError.make({ resource: 'project', message: `Project not found: ${key}` })
    );
  }

  const get_map = registry.getMapById.get(project.id);
  if (!get_map) {
    return yield* Effect.fail(
      NotFoundError.make({
        resource: 'project_map',
        message: `Project map loader not found: ${key}`
      })
    );
  }

  let entry = map_cache.get(project.id);
  if (!entry) {
    entry = { value: null, fetchedAt: 0, inFlight: null };
    map_cache.set(project.id, entry);
  }

  if (entry.value && is_cache_fresh(entry.fetchedAt)) {
    return entry.value;
  }
  if (entry.inFlight) {
    return yield* entry.inFlight;
  }

  const mapEntry = entry;
  const fetchEffect = yield* Effect.cached(
    get_map().pipe(
      Effect.tap((value) =>
        Effect.sync(() => {
          mapEntry.value = value;
          mapEntry.fetchedAt = Date.now();
          mapEntry.inFlight = null;
        })
      ),
      Effect.tapError(() =>
        Effect.sync(() => {
          mapEntry.inFlight = null;
        })
      )
    )
  );

  mapEntry.inFlight = fetchEffect;
  return yield* fetchEffect;
});

export const getProjectMapById = Effect.fn('getProjectMapById')(function* (id: number) {
  const registry = yield* getInternalRegistry();
  const project = registry.byId.get(id);
  if (!project) {
    return yield* Effect.fail(
      NotFoundError.make({ resource: 'project', message: `Project not found: ${id}` })
    );
  }
  return yield* getProjectMapByKey(project.key);
});

export const getProjectInfoByKey = Effect.fn('getProjectInfoByKey')(function* (key: string) {
  const cached = project_info_cache.get(key);
  if (cached?.value && is_cache_fresh(cached.fetchedAt)) {
    return yield* cached.value;
  }
  if (cached) project_info_cache.delete(key);

  const held: ProjectInfoEffectHolder = { current: null };

  const fetchEffect = yield* Effect.cached(
    Effect.gen(function* () {
      const registry = yield* getInternalRegistry();
      const project = registry.byKey.get(key);
      if (!project) {
        return yield* Effect.fail(
          NotFoundError.make({ resource: 'project', message: `Project not found: ${key}` })
        );
      }
      const map = yield* getProjectMapByKey(key);
      return build_project_info(project, map);
    }).pipe(
      Effect.tapError(() =>
        Effect.sync(() => {
          if (project_info_cache.get(key)?.value === held.current) {
            project_info_cache.delete(key);
          }
        })
      )
    )
  );

  held.current = fetchEffect;
  project_info_cache.set(key, { value: fetchEffect, fetchedAt: Date.now() });
  return yield* fetchEffect;
});

export const getProjectInfoById = Effect.fn('getProjectInfoById')(function* (id: number) {
  const registry = yield* getInternalRegistry();
  const project = registry.byId.get(id);
  if (!project) {
    return yield* Effect.fail(
      NotFoundError.make({ resource: 'project', message: `Project not found: ${id}` })
    );
  }
  return yield* getProjectInfoByKey(project.key);
});
