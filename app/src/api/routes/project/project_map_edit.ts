import { TRPCError } from '@trpc/server';
import { eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import {
  buildRedisKeysForDeleteInvalidation,
  collectDeleteInvalidation,
  countExactPathResources,
  deleteResourcesAtPathPrefixes
} from '~/server/map_path_delete_db.server';
import {
  applyDeletedSubtreesToMap,
  minimizeDbPathPrefixes,
  validateDeletedPathsInMap
} from '~/server/map_path_delete.server';
import { protectedAdminProcedure, t } from '~/api/trpc_init';
import { db } from '~/db/db';
import { projects } from '~/db/schema';
import { redis } from '~/db/redis';
import { REDIS_CACHE_KEYS_CLIENT } from '~/db/redis_shared';
import {
  clear_server_project_info_cache,
  clear_project_registry_cache,
  clear_server_project_map_cache
} from '~/server/project_list.server';
import {
  notify_site_invalidate_project_list_caches,
  notify_site_invalidate_project_map_cache
} from '~/server/invalidate_site_project_cache.server';
import {
  applyOrderedDbPathSwaps,
  buildRedisKeysForPathSwapInvalidation,
  collectPathSwapInvalidation,
  mergePathSwapInvalidation
} from '~/server/map_path_swap_db.server';
import {
  applyMetadataEditsToMap,
  applySwapEditsToMap,
  DB_PATH_RE,
  validateOrderRootPath,
  validateSwapEdits,
  validateSwapEditsRootScope
} from '~/server/map_path_swap';
import { delay } from '~/tools/delay';
import { recursive_list_schema } from '~/state/data_types';

const project_id_input = z.object({
  project_id: z.int()
});

const PROJECT_MAP_ORDER_LOCK_NAMESPACE = 41021;

const invalidate_project_caches = async (
  cookie: string,
  project_id: number,
  project_key: string,
  redisKeys: string[] = []
) => {
  clear_project_registry_cache();
  clear_server_project_map_cache(project_id);
  clear_server_project_info_cache(project_key);
  const keys = [
    REDIS_CACHE_KEYS_CLIENT.project_map(project_id),
    REDIS_CACHE_KEYS_CLIENT.project_list(),
    ...redisKeys
  ];
  await Promise.all([
    redis.del(...keys),
    notify_site_invalidate_project_map_cache(cookie, project_id),
    notify_site_invalidate_project_list_caches(cookie)
  ]);
};

export const update_project_map_route = protectedAdminProcedure
  .input(
    project_id_input.extend({
      map: recursive_list_schema
    })
  )
  .mutation(async ({ input, ctx: { cookie } }) => {
    await delay(400);
    const project = await db.transaction(async (tx) => {
      await tx.execute(
        sql`select pg_advisory_xact_lock(${PROJECT_MAP_ORDER_LOCK_NAMESPACE}, ${input.project_id})`
      );
      const existing = await tx.query.projects.findFirst({
        where: (tbl, { eq: eqId }) => eqId(tbl.id, input.project_id),
        columns: { id: true, key: true, map: true }
      });
      if (!existing) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found' });
      }
      let map = existing.map;
      try {
        map = applyMetadataEditsToMap(existing.map, input.map);
      } catch (error) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: error instanceof Error ? error.message : 'Invalid metadata-only map update'
        });
      }

      await tx
        .update(projects)
        .set({
          map,
          name_dev: map.name_dev
        })
        .where(eq(projects.id, input.project_id));

      return { key: existing.key, map };
    });

    await invalidate_project_caches(cookie, input.project_id, project.key);
    return { success: true as const, map: project.map };
  });

const db_path_schema = z
  .string()
  .regex(DB_PATH_RE, 'Path must be a colon-separated list of positive integers');

const save_project_map_order = protectedAdminProcedure
  .input(
    project_id_input.extend({
      root_path: z.array(z.int().positive()),
      edits: z.array(
        z.object({
          /** Ordered as `[from_path, to_path]`; server stages `to_path + "_temp"` to avoid clashes. */
          swap_paths: z.tuple([db_path_schema, db_path_schema])
        })
      ),
      map: recursive_list_schema
    })
  )
  .mutation(async ({ input: { project_id, root_path, edits, map }, ctx: { cookie } }) => {
    const parsedEdits = edits;
    if (parsedEdits.length > 0) {
      const validationError = validateSwapEdits(parsedEdits);
      if (validationError) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: validationError });
      }
      const rootScopeError = validateSwapEditsRootScope(parsedEdits, root_path);
      if (rootScopeError) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: rootScopeError });
      }
    }

    await delay(400);

    const { project, redisKeys } = await db.transaction(async (tx) => {
      await tx.execute(
        sql`select pg_advisory_xact_lock(${PROJECT_MAP_ORDER_LOCK_NAMESPACE}, ${project_id})`
      );
      const project = await tx.query.projects.findFirst({
        where: (tbl, { eq: eqId }) => eqId(tbl.id, project_id),
        columns: { id: true, key: true, map: true }
      });
      if (!project) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found' });
      }
      const rootError = validateOrderRootPath(project.map, root_path);
      if (rootError) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: rootError });
      }
      // Capture both states so moved descendants cannot leave stale cache entries behind.
      const invalidationBefore = await collectPathSwapInvalidation(tx, project_id, parsedEdits);
      if (parsedEdits.length > 0) {
        await applyOrderedDbPathSwaps(tx, project_id, parsedEdits);
      }
      const invalidationAfter = await collectPathSwapInvalidation(tx, project_id, parsedEdits);
      let derivedMap = project.map;
      try {
        derivedMap = applySwapEditsToMap(project.map, parsedEdits);
      } catch (error) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: error instanceof Error ? error.message : 'Invalid order swap payload'
        });
      }
      await tx
        .update(projects)
        .set({
          map: derivedMap,
          name_dev: derivedMap.name_dev
        })
        .where(eq(projects.id, project_id));

      return {
        project,
        map: derivedMap,
        redisKeys: buildRedisKeysForPathSwapInvalidation(
          project_id,
          mergePathSwapInvalidation(invalidationBefore, invalidationAfter)
        )
      };
    });

    await invalidate_project_caches(cookie, project_id, project.key, redisKeys);

    return { success: true as const, swap_count: parsedEdits.length, map };
  });

const delete_project_map_nodes = protectedAdminProcedure
  .input(
    project_id_input.extend({
      deleted_paths: z.array(db_path_schema)
    })
  )
  .mutation(async ({ input: { project_id, deleted_paths }, ctx: { cookie } }) => {
    const minimized = minimizeDbPathPrefixes(deleted_paths);
    if (minimized.length === 0) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'No nodes selected for deletion' });
    }

    await delay(400);

    const { project, map, redisKeys } = await db.transaction(async (tx) => {
      await tx.execute(
        sql`select pg_advisory_xact_lock(${PROJECT_MAP_ORDER_LOCK_NAMESPACE}, ${project_id})`
      );
      const project = await tx.query.projects.findFirst({
        where: (tbl, { eq: eqId }) => eqId(tbl.id, project_id),
        columns: { id: true, key: true, map: true }
      });
      if (!project) {
        throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found' });
      }

      const validationError = validateDeletedPathsInMap(project.map, minimized);
      if (validationError) {
        throw new TRPCError({ code: 'BAD_REQUEST', message: validationError });
      }

      let derivedMap: typeof project.map;
      try {
        derivedMap = applyDeletedSubtreesToMap(project.map, minimized);
      } catch (error) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: error instanceof Error ? error.message : 'Invalid delete paths for map'
        });
      }

      const invalidation = await collectDeleteInvalidation(tx, project_id, minimized);
      await deleteResourcesAtPathPrefixes(tx, project_id, minimized);

      await tx
        .update(projects)
        .set({
          map: derivedMap,
          name_dev: derivedMap.name_dev
        })
        .where(eq(projects.id, project_id));

      return {
        project,
        map: derivedMap,
        redisKeys: buildRedisKeysForDeleteInvalidation(project_id, invalidation)
      };
    });

    await invalidate_project_caches(cookie, project_id, project.key, redisKeys);

    return { success: true as const, deleted_count: minimized.length, map };
  });

const get_delete_node_resource_counts = protectedAdminProcedure
  .input(
    project_id_input.extend({
      path: db_path_schema
    })
  )
  .query(async ({ input: { project_id, path } }) => {
    const project = await db.query.projects.findFirst({
      where: (tbl, { eq: eqId }) => eqId(tbl.id, project_id),
      columns: { id: true }
    });
    if (!project) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found' });
    }

    return db.transaction((tx) => countExactPathResources(tx, project_id, path));
  });

export const project_map_edit_router = t.router({
  update: update_project_map_route,
  save_order: save_project_map_order,
  delete_nodes: delete_project_map_nodes,
  get_delete_node_resource_counts
});
