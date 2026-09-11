import { Effect } from 'effect';
import { dbRunHttp, dbTransaction, type TxOrDb } from '~/effect/database';
import { and, count, eq } from 'drizzle-orm';
import { z } from 'zod';
import { protectedAdminProcedure, t } from '~/api/trpc_init';
import { enqueueBackground } from '~/effect/background';
import {
  media_attachment,
  project_paths,
  project_redirects,
  projects,
  texts,
  translations,
  user_project_join,
  user_project_language_join
} from '~/db/schema';
import {
  CACHE,
  invalidate_and_refresh_cached,
  NO_CACHE_PARAMS
} from '~/utils/cache.server/cached_loader.server';
import { lekhaUrlSlugify } from '~/lib/carta_markdown/markdown';
import { is_reserved_project_route_slug } from '~/utils/reserved_project_route_slugs';
import {
  clear_server_project_map_cache,
  clear_project_registry_cache,
  clear_server_project_info_cache
} from '~/utils/project/list.server';
import { notify_site_invalidate_project_list_caches } from '~/utils/cache.server/invalidate_site_project_cache.server';
import { countResourcesForProject, insertProjectPaths } from '~/utils/project/paths_db.server';
import { finalize_project_delete_resource_counts } from '~/utils/project/project_delete';
import { ROOT_DB_PATH } from '~/utils/map_path/swap';
import { delay_dev } from '~/tools/delay';
import { type recursive_list_type, recursive_list_schema } from '~/state/data_types';
import { runTrpcEffect } from '~/effect/app_runtime.server';
import { BadRequestError, ConflictError, NotFoundError } from '~/effect/errors';

const project_id_input = z.object({
  project_id: z.int()
});

const find_project = (tx: TxOrDb, project_id: number) =>
  tx.query.projects.findFirst({
    where: (tbl, { eq: eqId }) => eqId(tbl.id, project_id),
    columns: { id: true, key: true, listed: true }
  });

/** Ensures `project_id` exists; fails with NotFoundError otherwise. */
const require_project = Effect.fn('require_project')(function* (project_id: number) {
  const project = yield* dbRunHttp('project_edit.require', (db) => find_project(db, project_id));
  if (!project) {
    return yield* Effect.fail(
      NotFoundError.make({ resource: 'project', message: 'Project not found' })
    );
  }
  return project;
});

const invalidate_project_list_caches = Effect.fn('invalidate_project_list_caches')(function* (
  cookie: string
) {
  clear_project_registry_cache();
  yield* invalidate_and_refresh_cached(CACHE.project_list, NO_CACHE_PARAMS);
  yield* enqueueBackground(() => notify_site_invalidate_project_list_caches(cookie));
});

export const update_project_name_description_route = protectedAdminProcedure
  .input(
    project_id_input.extend({
      name: z.string().trim().min(1).max(300),
      name_dev: z.string().trim().min(1).max(300),
      description: z.string().max(5000).optional().nullable()
    })
  )
  .mutation(({ input, ctx: { cookie } }) =>
    runTrpcEffect(
      Effect.gen(function* () {
        yield* Effect.promise(async () => {
          await delay_dev(400);
        });

        const outcome = yield* dbRunHttp('project_edit.update_meta', async (db) => {
          const project = await find_project(db, input.project_id);
          if (!project) return { ok: false as const, reason: 'not_found' as const };

          const { map: project_map } = (await db.query.projects.findFirst({
            where: ({ id }, { eq }) => eq(id, input.project_id),
            columns: { map: true }
          }))!;
          // update top level name as it same as name_dev
          project_map.name_dev = input.name_dev;
          await db
            .update(projects)
            .set({
              name: input.name,
              name_dev: input.name_dev,
              description: input.description ?? null,
              map: recursive_list_schema.parse(project_map)
            })
            .where(eq(projects.id, input.project_id));

          return { ok: true as const };
        });

        if (!outcome.ok) {
          return yield* Effect.fail(
            NotFoundError.make({ resource: 'project', message: 'Project not found' })
          );
        }

        yield* invalidate_project_list_caches(cookie);
        return { success: true };
      })
    )
  );

export const edit_project_slug_route = protectedAdminProcedure
  .input(
    project_id_input.extend({
      key: z.string().trim().min(1).max(100),
      /** When true, keep the previous key as a redirect to this project. Default true. */
      redirect_old_url: z.boolean().default(true)
    })
  )
  .mutation(({ input, ctx: { cookie } }) =>
    runTrpcEffect(
      Effect.gen(function* () {
        yield* Effect.promise(async () => {
          await delay_dev(400);
        });

        const outcome = yield* dbTransaction('project_edit.tx.2', async (tx) => {
          const project = await find_project(tx, input.project_id);
          if (!project) return { ok: false as const, reason: 'not_found' as const };

          const previous_key = project.key;
          const key = lekhaUrlSlugify(input.key);
          if (!key) {
            return {
              ok: false as const,
              reason: 'bad_request' as const,
              message: 'Slug must contain at least one alphanumeric character'
            };
          }
          if (is_reserved_project_route_slug(key)) {
            return {
              ok: false as const,
              reason: 'conflict' as const,
              message: 'This slug is reserved (conflicts with an app route)'
            };
          }

          if (key === project.key) {
            return { ok: true as const, previous_key };
          }

          const conflict = await tx.query.projects.findFirst({
            where: (tbl, { eq: eqKey }) => eqKey(tbl.key, key),
            columns: { id: true }
          });
          if (conflict) {
            return {
              ok: false as const,
              reason: 'conflict' as const,
              message: 'This slug is already used by another project. You cannot use it.'
            };
          }

          // Claiming a key that currently redirects somewhere else replaces that rule.
          await tx.delete(project_redirects).where(eq(project_redirects.key, key));

          await tx.update(projects).set({ key }).where(eq(projects.id, input.project_id));

          if (input.redirect_old_url) {
            await tx
              .insert(project_redirects)
              .values({ project_id: input.project_id, key: project.key })
              .onConflictDoUpdate({
                target: project_redirects.key,
                set: { project_id: input.project_id }
              });
          }

          return { ok: true as const, previous_key };
        });

        if (!outcome.ok) {
          if (outcome.reason === 'not_found') {
            return yield* Effect.fail(
              NotFoundError.make({ resource: 'project', message: 'Project not found' })
            );
          }
          if (outcome.reason === 'bad_request') {
            return yield* Effect.fail(BadRequestError.make({ message: outcome.message }));
          }
          return yield* Effect.fail(ConflictError.make({ message: outcome.message }));
        }

        if (outcome.previous_key) {
          clear_server_project_info_cache(outcome.previous_key);
        }
        yield* invalidate_project_list_caches(cookie);
        return { success: true };
      })
    )
  );

export const list_project_redirects_route = protectedAdminProcedure
  .input(project_id_input)
  .query(({ input }) =>
    runTrpcEffect(
      Effect.gen(function* () {
        yield* Effect.promise(async () => {
          await delay_dev(200);
        });
        yield* require_project(input.project_id);
        return yield* dbRunHttp('project_edit.db.1', (db) =>
          db.query.project_redirects.findMany({
            where: (tbl, { eq: eqId }) => eqId(tbl.project_id, input.project_id),
            columns: { id: true, key: true, created_at: true },
            orderBy: (tbl, { desc }) => [desc(tbl.created_at)]
          })
        );
      })
    )
  );

export const delete_project_redirect_route = protectedAdminProcedure
  .input(
    project_id_input.extend({
      redirect_id: z.int()
    })
  )
  .mutation(({ input, ctx: { cookie } }) =>
    runTrpcEffect(
      Effect.gen(function* () {
        yield* Effect.promise(async () => {
          await delay_dev(300);
        });

        const outcome = yield* dbRunHttp('project_edit.delete_redirect', async (db) => {
          const project = await find_project(db, input.project_id);
          if (!project) return { ok: false as const, reason: 'not_found' as const };

          const deleted = await db
            .delete(project_redirects)
            .where(
              and(
                eq(project_redirects.id, input.redirect_id),
                eq(project_redirects.project_id, input.project_id)
              )
            )
            .returning();
          if (deleted.length === 0) {
            return { ok: false as const, reason: 'redirect_not_found' as const };
          }
          return { ok: true as const };
        });

        if (!outcome.ok) {
          if (outcome.reason === 'redirect_not_found') {
            return yield* Effect.fail(
              NotFoundError.make({
                resource: 'project_redirect',
                message: 'Redirect rule not found'
              })
            );
          }
          return yield* Effect.fail(
            NotFoundError.make({ resource: 'project', message: 'Project not found' })
          );
        }

        yield* invalidate_project_list_caches(cookie);
        return { success: true as const };
      })
    )
  );

export const update_project_listed_route = protectedAdminProcedure
  .input(
    project_id_input.extend({
      listed: z.boolean()
    })
  )
  .mutation(({ input, ctx: { cookie } }) =>
    runTrpcEffect(
      Effect.gen(function* () {
        yield* Effect.promise(async () => {
          await delay_dev(400);
        });

        const outcome = yield* dbRunHttp('project_edit.update_listed', async (db) => {
          const project = await find_project(db, input.project_id);
          if (!project) return { ok: false as const, reason: 'not_found' as const };

          await db
            .update(projects)
            .set({ listed: input.listed })
            .where(eq(projects.id, input.project_id));
          return { ok: true as const };
        });

        if (!outcome.ok) {
          return yield* Effect.fail(
            NotFoundError.make({ resource: 'project', message: 'Project not found' })
          );
        }

        yield* invalidate_project_list_caches(cookie);
        return { success: true };
      })
    )
  );

const get_delete_resource_counts_for_project = async (tx: TxOrDb, project_id: number) => {
  const count_rows_for_project = async (
    tx: TxOrDb,
    project_id: number,
    table: typeof project_paths | typeof user_project_join | typeof user_project_language_join
  ) => {
    const [row] = await tx
      .select({ count: count() })
      .from(table)
      .where(eq(table.project_id, project_id));
    return Number(row?.count ?? 0);
  };
  const [
    texts_count,
    translations_count,
    media_count,
    project_paths_count,
    users_join_count,
    user_languages_count,
    project_row
  ] = await Promise.all([
    countResourcesForProject(tx, project_id, texts),
    countResourcesForProject(tx, project_id, translations),
    countResourcesForProject(tx, project_id, media_attachment),
    count_rows_for_project(tx, project_id, project_paths),
    count_rows_for_project(tx, project_id, user_project_join),
    count_rows_for_project(tx, project_id, user_project_language_join),
    tx.query.projects.findFirst({
      where: (tbl, { eq: eqId }) => eqId(tbl.id, project_id),
      columns: { map: true }
    })
  ]);

  return finalize_project_delete_resource_counts({
    map: project_row?.map,
    texts: texts_count,
    translations: translations_count,
    media_attachment: media_count,
    project_paths: project_paths_count,
    user_project_join: users_join_count,
    user_project_language_join: user_languages_count
  });
};

export const get_delete_resource_counts_route = protectedAdminProcedure
  .input(project_id_input)
  .query(({ input }) =>
    runTrpcEffect(
      Effect.gen(function* () {
        yield* Effect.promise(async () => {
          await delay_dev(300);
        });
        const counts = yield* dbRunHttp('project_edit.delete_counts', async (db) => {
          const project = await find_project(db, input.project_id);
          if (!project) return null;
          return get_delete_resource_counts_for_project(db, input.project_id);
        });
        if (!counts) {
          return yield* Effect.fail(
            NotFoundError.make({ resource: 'project', message: 'Project not found' })
          );
        }
        return counts;
      })
    )
  );

export const delete_project_route = protectedAdminProcedure
  .input(project_id_input)
  .mutation(({ input, ctx: { cookie } }) =>
    runTrpcEffect(
      Effect.gen(function* () {
        yield* Effect.promise(async () => {
          await delay_dev(400);
        });

        const outcome = yield* dbTransaction('project_edit.tx.5', async (tx) => {
          const project = await find_project(tx, input.project_id);
          if (!project) return { ok: false as const, reason: 'not_found' as const };

          const counts = await get_delete_resource_counts_for_project(tx, input.project_id);
          if (counts.total > 0) {
            return { ok: false as const, reason: 'has_resources' as const };
          }
          // Root path FK is RESTRICT — clear empty shloka root path(s) before the project row.
          if (counts.auto_clear_project_paths) {
            await tx.delete(project_paths).where(eq(project_paths.project_id, input.project_id));
          }
          await tx.delete(projects).where(eq(projects.id, input.project_id));
          return { ok: true as const };
        });

        if (!outcome.ok) {
          if (outcome.reason === 'has_resources') {
            return yield* Effect.fail(
              ConflictError.make({
                message:
                  'This project still has connected data and cannot be deleted. Remove all related records first.'
              })
            );
          }
          return yield* Effect.fail(
            NotFoundError.make({ resource: 'project', message: 'Project not found' })
          );
        }

        clear_server_project_map_cache(input.project_id);
        yield* invalidate_project_list_caches(cookie);
        return { success: true as const };
      })
    )
  );

export const check_project_slug_route = protectedAdminProcedure
  .input(
    z.object({
      slug: z.string().max(100),
      /** When editing, ignore this project's own current key as a conflict. */
      exclude_project_id: z.int().optional()
    })
  )
  .query(({ input }) =>
    runTrpcEffect(
      Effect.gen(function* () {
        yield* Effect.promise(async () => {
          await delay_dev(200);
        });
        const key = lekhaUrlSlugify(input.slug);
        if (!key) {
          return { available: false, key: '', replaces_redirect: false as const };
        }
        if (is_reserved_project_route_slug(key)) {
          return { available: false, key, replaces_redirect: false as const };
        }

        const conflict = yield* dbRunHttp('project_edit.db.2', (db) =>
          db.query.projects.findFirst({
            where: (tbl, { eq: eqId }) => eqId(tbl.key, key),
            columns: { id: true }
          })
        );
        const active_conflict =
          !!conflict &&
          (input.exclude_project_id === undefined || conflict.id !== input.exclude_project_id);

        const redirect = yield* dbRunHttp('project_edit.db.3', (db) =>
          db.query.project_redirects.findFirst({
            where: (tbl, { eq: eqKey }) => eqKey(tbl.key, key),
            columns: { id: true, project_id: true, key: true }
          })
        );

        return {
          available: !active_conflict,
          key,
          replaces_redirect: !!redirect,
          redirect_key: redirect?.key ?? null
        };
      })
    )
  );

const add_new_project_route = protectedAdminProcedure
  .input(
    z.object({
      name: z.string().trim().min(1).max(300),
      name_dev: z.string().trim().min(1).max(300),
      description: z.string().max(5000).optional().nullable(),
      slug: z.string().trim().min(1).max(100)
    })
  )
  .mutation(({ input: { name, name_dev, description, slug }, ctx: { cookie } }) =>
    runTrpcEffect(
      Effect.gen(function* () {
        yield* Effect.promise(async () => {
          await delay_dev(400);
        });
        const key = lekhaUrlSlugify(slug);
        if (!key) {
          return yield* Effect.fail(
            BadRequestError.make({
              message: 'Slug must contain at least one alphanumeric character'
            })
          );
        }
        if (is_reserved_project_route_slug(key)) {
          return yield* Effect.fail(
            ConflictError.make({
              message: 'This slug is reserved (conflicts with an app route)'
            })
          );
        }

        const outcome = yield* dbTransaction('project_edit.tx.6', async (tx) => {
          const conflict = await tx.query.projects.findFirst({
            where: (tbl, { eq: eqId }) => eqId(tbl.key, key),
            columns: { id: true }
          });
          if (conflict) {
            return { ok: false as const, reason: 'conflict' as const };
          }

          // New project claiming a former redirect key replaces that rule.
          await tx.delete(project_redirects).where(eq(project_redirects.key, key));

          const [inserted] = await tx
            .insert(projects)
            .values({
              name,
              name_dev,
              description: description ?? null,
              key,
              listed: false,
              map: recursive_list_schema.parse({
                name_dev,
                list: [],
                info: {
                  type: 'shloka',
                  shloka_count: 0,
                  total: 0
                }
              } satisfies recursive_list_type)
            })
            .returning();
          await insertProjectPaths(tx, inserted.id, [ROOT_DB_PATH]);
          return { ok: true as const, project: inserted };
        });

        if (!outcome.ok) {
          return yield* Effect.fail(ConflictError.make({ message: 'This slug is already in use' }));
        }

        yield* invalidate_project_list_caches(cookie);
        return { success: true as const, project: outcome.project };
      })
    )
  );

export const project_edit_router = t.router({
  update_name_description: update_project_name_description_route,
  edit_project_slug: edit_project_slug_route,
  update_listed: update_project_listed_route,
  get_delete_resource_counts: get_delete_resource_counts_route,
  delete_project: delete_project_route,
  check_project_slug: check_project_slug_route,
  list_project_redirects: list_project_redirects_route,
  delete_project_redirect: delete_project_redirect_route,
  add_new_project: add_new_project_route
});
