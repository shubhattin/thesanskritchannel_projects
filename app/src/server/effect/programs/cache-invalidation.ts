import { Effect } from 'effect';
import { ProjectService } from '../project';
import { RedisService, redis_del_effect } from '../redis';

/** Clears in-memory registry + Redis keys for the global project list. */
export const invalidate_project_list_caches_effect = () =>
  Effect.gen(function* () {
    const project = yield* ProjectService;
    const redis = yield* RedisService;
    yield* project.clearRegistryCache();
    yield* redis.del(redis.keys.project_list());
  });

/** Clears in-memory map/info/registry caches and Redis keys for one project. */
export const invalidate_project_caches_effect = (
  projectId: number,
  projectKey: string,
  extraRedisKeys: string[] = []
) =>
  Effect.gen(function* () {
    const project = yield* ProjectService;
    const redis = yield* RedisService;
    yield* project.clearRegistryCache();
    yield* project.clearMapCache(projectId);
    yield* project.clearInfoCache(projectKey);
    const keys = [redis.keys.project_map(projectId), redis.keys.project_list(), ...extraRedisKeys];
    if (keys.length > 0) {
      yield* redis.del(...keys);
    }
  });

/** Clears in-memory map/info caches for one project (no Redis). */
export const clear_project_memory_caches_effect = (projectId: number, projectKey: string) =>
  Effect.gen(function* () {
    const project = yield* ProjectService;
    yield* project.clearMapCache(projectId);
    yield* project.clearInfoCache(projectKey);
  });

export const invalidate_text_edit_redis_effect = (...keys: string[]) =>
  keys.length > 0 ? redis_del_effect(...keys) : Effect.void;
