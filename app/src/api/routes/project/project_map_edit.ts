import { Effect } from 'effect';
import { dbRun, dbTransaction } from '~/effect/database';
import { eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { enqueueBackground } from '~/effect/background';
import {
  applyDeletePathCompactions,
  collectDeleteInvalidation,
  deleteResourcesAtPathPrefixes
} from '~/utils/map_path/delete_db.server';
import {
  applyDeletedSubtreesToMap,
  buildDeletePathCompactions,
  listDeleteCompactionPrefixes,
  minimizeDbPathPrefixes,
  validateDeletedPathsInMap
} from '~/utils/map_path/delete.server';
import { protectedAdminProcedure, t } from '~/api/trpc_init';
import { projects } from '~/db/schema';
import {
  CACHE,
  invalidate_and_refresh_cached,
  invalidate_path_caches,
  NO_CACHE_PARAMS
} from '~/utils/cache.server/cached_loader.server';
import type { PathSwapInvalidation } from '~/utils/map_path/swap_db.server';
import {
  clear_server_project_info_cache,
  clear_project_registry_cache,
  clear_server_project_map_cache
} from '~/utils/project/list.server';
import {
  notify_site_invalidate_project_list_caches,
  notify_site_invalidate_project_map_cache
} from '~/utils/cache.server/invalidate_site_project_cache.server';
import {
  applyOrderedDbPathSwaps,
  collectPathSwapInvalidation,
  mergePathSwapInvalidation
} from '~/utils/map_path/swap_db.server';
import {
  applyMetadataEditsToMap,
  applySwapEditsToMap,
  validateOrderRootPath,
  validateSwapEdits,
  validateSwapEditsRootScope,
  validateDbPath
} from '~/utils/map_path/swap';
import { delay_dev } from '~/tools/delay';
import { recursive_list_schema } from '~/state/data_types';
import {
  countExactPathResources,
  deleteProjectPathsAtExact,
  insertProjectPaths
} from '~/utils/project/paths_db.server';
import {
  collect_shloka_db_paths_from_map,
  diff_shloka_db_paths,
  validate_explicit_to_add_paths
} from '~/utils/project/map_sync.server';
import { TEXT_EDIT_LOCK_NAMESPACE } from '~/utils/text/row_edit.server';
import { runServerEffect, runTrpcEffect } from '~/effect/app_runtime.server';
import { BadRequestError, NotFoundError } from '~/effect/errors';

const project_id_input = z.object({
  project_id: z.int()
});

const invalidate_project_caches = Effect.fn('invalidate_project_caches')(function* (
  cookie: string,
  project_id: number,
  project_key: string,
  pathInvalidation?: PathSwapInvalidation
) {
  clear_project_registry_cache();
  clear_server_project_map_cache(project_id);
  clear_server_project_info_cache(project_key);
  yield* Effect.all(
    [
      invalidate_and_refresh_cached(CACHE.project_map, { project_id }),
      invalidate_and_refresh_cached(CACHE.project_list, NO_CACHE_PARAMS),
      ...(pathInvalidation
        ? [invalidate_path_caches(project_id, project_key, pathInvalidation)]
        : []),
      Effect.promise(() => notify_site_invalidate_project_map_cache(cookie, project_id)),
      Effect.promise(() => notify_site_invalidate_project_list_caches(cookie))
    ],
    { concurrency: 'unbounded' }
  );
});

export const update_project_map_route = protectedAdminProcedure
  .input(
    project_id_input.extend({
      map: recursive_list_schema,
      to_add_paths: z.array(z.string()).default([])
    })
  )
  .mutation(({ input, ctx: { cookie } }) =>
    runTrpcEffect(
      Effect.gen(function* () {
        yield* Effect.promise(async () => {
          await delay_dev(400);
        });

        const outcome = yield* dbTransaction('project_map_edit.tx.1', async (tx) => {
          await tx.execute(
            sql`select pg_advisory_xact_lock(${TEXT_EDIT_LOCK_NAMESPACE}, ${input.project_id})`
          );
          const existing = await tx.query.projects.findFirst({
            where: (tbl, { eq: eqId }) => eqId(tbl.id, input.project_id),
            columns: { id: true, key: true, map: true }
          });
          if (!existing) {
            return { ok: false as const, reason: 'not_found' as const };
          }
          let map = existing.map;
          try {
            map = applyMetadataEditsToMap(existing.map, input.map);
          } catch (error) {
            return {
              ok: false as const,
              reason: 'bad_request' as const,
              message: error instanceof Error ? error.message : 'Invalid metadata-only map update'
            };
          }

          const oldShlokaPaths = collect_shloka_db_paths_from_map(existing.map);
          const newShlokaPaths = collect_shloka_db_paths_from_map(map);
          validate_explicit_to_add_paths(oldShlokaPaths, newShlokaPaths, input.to_add_paths);
          const { toInsert, toRemove } = diff_shloka_db_paths(existing.map, map);

          await deleteProjectPathsAtExact(tx, input.project_id, toRemove);
          await insertProjectPaths(tx, input.project_id, toInsert);

          await tx
            .update(projects)
            .set({
              map,
              name_dev: map.name_dev
            })
            .where(eq(projects.id, input.project_id));

          return { ok: true as const, key: existing.key, map };
        });

        if (!outcome.ok) {
          if (outcome.reason === 'not_found') {
            return yield* Effect.fail(
              NotFoundError.make({ resource: 'project', message: 'Project not found' })
            );
          }
          return yield* Effect.fail(BadRequestError.make({ message: outcome.message }));
        }

        yield* enqueueBackground(() =>
          runServerEffect(invalidate_project_caches(cookie, input.project_id, outcome.key))
        );
        return { success: true as const, map: outcome.map };
      })
    )
  );

const db_path_schema = z.string().refine((path) => validateDbPath(path) === null, {
  message: 'Path must be a colon-separated list of positive integers'
});

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
  .mutation(({ input: { project_id, root_path, edits }, ctx: { cookie } }) =>
    runTrpcEffect(
      Effect.gen(function* () {
        const parsedEdits = edits;
        if (parsedEdits.length > 0) {
          const validationError = validateSwapEdits(parsedEdits);
          if (validationError) {
            return yield* Effect.fail(BadRequestError.make({ message: validationError }));
          }
          const rootScopeError = validateSwapEditsRootScope(parsedEdits, root_path);
          if (rootScopeError) {
            return yield* Effect.fail(BadRequestError.make({ message: rootScopeError }));
          }
        }

        yield* Effect.promise(async () => {
          await delay_dev(400);
        });

        const outcome = yield* dbTransaction('project_map_edit.tx.2', async (tx) => {
          await tx.execute(
            sql`select pg_advisory_xact_lock(${TEXT_EDIT_LOCK_NAMESPACE}, ${project_id})`
          );
          const project = await tx.query.projects.findFirst({
            where: (tbl, { eq: eqId }) => eqId(tbl.id, project_id),
            columns: { id: true, key: true, map: true }
          });
          if (!project) {
            return { ok: false as const, reason: 'not_found' as const };
          }
          const rootError = validateOrderRootPath(project.map, root_path);
          if (rootError) {
            return { ok: false as const, reason: 'bad_request' as const, message: rootError };
          }
          // Validate map derivation before DB path swaps so a bad payload cannot leave
          // projects.map and project_paths out of sync (returning from the tx commits).
          let derivedMap = project.map;
          try {
            derivedMap = applySwapEditsToMap(project.map, parsedEdits);
          } catch (error) {
            return {
              ok: false as const,
              reason: 'bad_request' as const,
              message: error instanceof Error ? error.message : 'Invalid order swap payload'
            };
          }
          // Capture both states so moved descendants cannot leave stale cache entries behind.
          const invalidationBefore = await collectPathSwapInvalidation(tx, project_id, parsedEdits);
          if (parsedEdits.length > 0) {
            await applyOrderedDbPathSwaps(tx, project_id, parsedEdits);
          }
          const invalidationAfter = await collectPathSwapInvalidation(tx, project_id, parsedEdits);
          await tx
            .update(projects)
            .set({
              map: derivedMap,
              name_dev: derivedMap.name_dev
            })
            .where(eq(projects.id, project_id));

          return {
            ok: true as const,
            project,
            map: derivedMap,
            pathInvalidation: mergePathSwapInvalidation(invalidationBefore, invalidationAfter)
          };
        });

        if (!outcome.ok) {
          if (outcome.reason === 'not_found') {
            return yield* Effect.fail(
              NotFoundError.make({ resource: 'project', message: 'Project not found' })
            );
          }
          return yield* Effect.fail(BadRequestError.make({ message: outcome.message }));
        }

        yield* enqueueBackground(() =>
          runServerEffect(
            invalidate_project_caches(
              cookie,
              project_id,
              outcome.project.key,
              outcome.pathInvalidation
            )
          )
        );

        return {
          success: true as const,
          swap_count: parsedEdits.length,
          map: outcome.map
        };
      })
    )
  );

const delete_project_map_nodes = protectedAdminProcedure
  .input(
    project_id_input.extend({
      deleted_paths: z.array(db_path_schema)
    })
  )
  .mutation(({ input: { project_id, deleted_paths }, ctx: { cookie } }) =>
    runTrpcEffect(
      Effect.gen(function* () {
        const minimized = minimizeDbPathPrefixes(deleted_paths);
        if (minimized.length === 0) {
          return yield* Effect.fail(
            BadRequestError.make({ message: 'No nodes selected for deletion' })
          );
        }

        yield* Effect.promise(async () => {
          await delay_dev(400);
        });

        const outcome = yield* dbTransaction('project_map_edit.tx.3', async (tx) => {
          await tx.execute(
            sql`select pg_advisory_xact_lock(${TEXT_EDIT_LOCK_NAMESPACE}, ${project_id})`
          );
          const project = await tx.query.projects.findFirst({
            where: (tbl, { eq: eqId }) => eqId(tbl.id, project_id),
            columns: { id: true, key: true, map: true }
          });
          if (!project) {
            return { ok: false as const, reason: 'not_found' as const };
          }

          const validationError = validateDeletedPathsInMap(project.map, minimized);
          if (validationError) {
            return {
              ok: false as const,
              reason: 'bad_request' as const,
              message: validationError
            };
          }

          let derivedMap: typeof project.map;
          let deleteCompactions: ReturnType<typeof buildDeletePathCompactions>;
          try {
            derivedMap = applyDeletedSubtreesToMap(project.map, minimized);
            deleteCompactions = buildDeletePathCompactions(project.map, minimized);
          } catch (error) {
            return {
              ok: false as const,
              reason: 'bad_request' as const,
              message: error instanceof Error ? error.message : 'Invalid delete paths for map'
            };
          }

          const touchedPrefixes = listDeleteCompactionPrefixes(deleteCompactions);
          const invalidationBefore = await collectDeleteInvalidation(
            tx,
            project_id,
            touchedPrefixes
          );
          await deleteResourcesAtPathPrefixes(tx, project_id, minimized);
          await applyDeletePathCompactions(tx, project_id, deleteCompactions);
          const invalidationAfter = await collectDeleteInvalidation(
            tx,
            project_id,
            touchedPrefixes
          );

          await tx
            .update(projects)
            .set({
              map: derivedMap,
              name_dev: derivedMap.name_dev
            })
            .where(eq(projects.id, project_id));

          return {
            ok: true as const,
            project,
            map: derivedMap,
            pathInvalidation: mergePathSwapInvalidation(invalidationBefore, invalidationAfter)
          };
        });

        if (!outcome.ok) {
          if (outcome.reason === 'not_found') {
            return yield* Effect.fail(
              NotFoundError.make({ resource: 'project', message: 'Project not found' })
            );
          }
          return yield* Effect.fail(BadRequestError.make({ message: outcome.message }));
        }

        yield* enqueueBackground(() =>
          runServerEffect(
            invalidate_project_caches(
              cookie,
              project_id,
              outcome.project.key,
              outcome.pathInvalidation
            )
          )
        );

        return {
          success: true as const,
          deleted_count: minimized.length,
          map: outcome.map
        };
      })
    )
  );

const get_delete_node_resource_counts = protectedAdminProcedure
  .input(
    project_id_input.extend({
      paths: z.array(db_path_schema)
    })
  )
  .query(({ input: { project_id, paths } }) =>
    runTrpcEffect(
      Effect.gen(function* () {
        const project = yield* dbRun('project_map_edit.db.1', (db) =>
          db.query.projects.findFirst({
            where: (tbl, { eq: eqId }) => eqId(tbl.id, project_id),
            columns: { id: true }
          })
        );
        if (!project) {
          return yield* Effect.fail(
            NotFoundError.make({ resource: 'project', message: 'Project not found' })
          );
        }

        return yield* dbTransaction('project_map_edit.tx.4', async (tx) => {
          const countsByPath: Record<
            string,
            Awaited<ReturnType<typeof countExactPathResources>>
          > = {};
          for (const path of new Set(paths)) {
            countsByPath[path] = await countExactPathResources(tx, project_id, path);
          }
          return countsByPath;
        });
      })
    )
  );

export const project_map_edit_router = t.router({
  update: update_project_map_route,
  save_order: save_project_map_order,
  delete_nodes: delete_project_map_nodes,
  get_delete_node_resource_counts
});
