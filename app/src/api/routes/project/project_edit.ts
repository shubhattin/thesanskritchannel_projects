import { TRPCError } from '@trpc/server';
import { count, eq } from 'drizzle-orm';
import { z } from 'zod';
import { waitUntil } from '@vercel/functions';
import { protectedAdminProcedure, t } from '~/api/trpc_init';
import { db, type transactionType } from '~/db/db';
import {
  media_attachment,
  project_paths,
  projects,
  texts,
  translations,
  user_project_join,
  user_project_language_join
} from '~/db/schema';
import { cache_db_options_app } from '~/utils/cache.server/cache_db_options.server';
import {
  CACHE,
  invalidate_and_refresh_cached,
  NO_CACHE_PARAMS
} from '~/utils/cache.server/cached_loader.server';
import { lekhaUrlSlugify } from '~/lib/carta_markdown/markdown';
import {
  clear_server_project_map_cache,
  clear_project_registry_cache
} from '~/utils/project/list.server';
import { notify_site_invalidate_project_list_caches } from '~/utils/cache.server/invalidate_site_project_cache.server';
import { countResourcesForProject, insertProjectPaths } from '~/utils/project/paths_db.server';
import { ROOT_DB_PATH } from '~/utils/map_path/swap';
import { delay_dev } from '~/tools/delay';
import { type recursive_list_type, recursive_list_schema } from '~/state/data_types';

const project_id_input = z.object({
  project_id: z.int()
});

const invalidate_project_list_caches = async (cookie: string) => {
  clear_project_registry_cache();
  await invalidate_and_refresh_cached(CACHE.project_list, NO_CACHE_PARAMS, cache_db_options_app);
  waitUntil(notify_site_invalidate_project_list_caches(cookie));
};

/** Ensures `project_id` exists; throws NOT_FOUND otherwise. */
const require_project = async (tx: transactionType, project_id: number) => {
  const project = await tx.query.projects.findFirst({
    where: (tbl, { eq: eqId }) => eqId(tbl.id, project_id),
    columns: { id: true, key: true, listed: true }
  });
  if (!project) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found' });
  }
  return project;
};

export const update_project_name_description_route = protectedAdminProcedure
  .input(
    project_id_input.extend({
      name: z.string().trim().min(1).max(300),
      name_dev: z.string().trim().min(1).max(300),
      description: z.string().max(5000).optional().nullable()
    })
  )
  .mutation(async ({ input, ctx: { cookie } }) => {
    await delay_dev(400);
    await db.transaction(async (tx) => {
      await require_project(tx, input.project_id);
      const { map: project_map } = (await tx.query.projects.findFirst({
        where: ({ id }, { eq }) => eq(id, input.project_id),
        columns: { map: true }
      }))!;
      // update top level name as it same as name_dev
      project_map.name_dev = input.name_dev;
      await tx
        .update(projects)
        .set({
          name: input.name,
          name_dev: input.name_dev,
          description: input.description ?? null,
          map: recursive_list_schema.parse(project_map)
        })
        .where(eq(projects.id, input.project_id));
    });

    await invalidate_project_list_caches(cookie);
    return { success: true };
  });

export const edit_project_slug_route = protectedAdminProcedure
  .input(
    project_id_input.extend({
      key: z.string().trim().min(1).max(100)
    })
  )
  .mutation(async ({ input, ctx: { cookie } }) => {
    await delay_dev(400);
    await db.transaction(async (tx) => {
      await require_project(tx, input.project_id);
      const key = lekhaUrlSlugify(input.key);

      const conflict = await tx.query.projects.findFirst({
        where: (tbl, { eq }) => eq(tbl.key, key),
        columns: { id: true }
      });
      if (conflict) {
        throw new TRPCError({ code: 'CONFLICT', message: 'This slug is already in use' });
      }

      await tx.update(projects).set({ key }).where(eq(projects.id, input.project_id));
    });

    await invalidate_project_list_caches(cookie);
    return { success: true };
  });

export const update_project_listed_route = protectedAdminProcedure
  .input(
    project_id_input.extend({
      listed: z.boolean()
    })
  )
  .mutation(async ({ input, ctx: { cookie } }) => {
    await delay_dev(400);
    await db.transaction(async (tx) => {
      await require_project(tx, input.project_id);
      await tx
        .update(projects)
        .set({ listed: input.listed })
        .where(eq(projects.id, input.project_id));
    });

    await invalidate_project_list_caches(cookie);
    return { success: true };
  });

const get_delete_resource_counts_for_project = async (project_id: number) => {
  const count_rows_for_project = async (
    tx: transactionType,
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
    user_languages_count
  ] = await Promise.all([
    countResourcesForProject(db, project_id, texts),
    countResourcesForProject(db, project_id, translations),
    countResourcesForProject(db, project_id, media_attachment),
    count_rows_for_project(db, project_id, project_paths),
    count_rows_for_project(db, project_id, user_project_join),
    count_rows_for_project(db, project_id, user_project_language_join)
  ]);

  return {
    texts: texts_count,
    translations: translations_count,
    media_attachment: media_count,
    project_paths: project_paths_count,
    user_project_join: users_join_count,
    user_project_language_join: user_languages_count,
    total:
      texts_count +
      translations_count +
      media_count +
      project_paths_count +
      users_join_count +
      user_languages_count
  };
};

export const get_delete_resource_counts_route = protectedAdminProcedure
  .input(project_id_input)
  .query(async ({ input }) => {
    await delay_dev(300);
    await require_project(db, input.project_id);
    return get_delete_resource_counts_for_project(input.project_id);
  });

export const delete_project_route = protectedAdminProcedure
  .input(project_id_input)
  .mutation(async ({ input, ctx: { cookie } }) => {
    await delay_dev(400);
    await db.transaction(async (tx) => {
      await require_project(tx, input.project_id);
      const counts = await get_delete_resource_counts_for_project(input.project_id);
      if (counts.total > 0) {
        throw new TRPCError({
          code: 'PRECONDITION_FAILED',
          message:
            'This project still has connected data and cannot be deleted. Remove all related records first.'
        });
      }
      await tx.delete(projects).where(eq(projects.id, input.project_id));
    });

    clear_server_project_map_cache(input.project_id);
    await invalidate_project_list_caches(cookie);
    return { success: true as const };
  });

export const check_project_slug_route = protectedAdminProcedure
  .input(z.object({ slug: z.string().max(100) }))
  .query(async ({ input }) => {
    await delay_dev(200);
    const key = lekhaUrlSlugify(input.slug);
    if (!key) {
      return { available: false, key: '' };
    }
    const conflict = await db.query.projects.findFirst({
      where: (tbl, { eq: eqId }) => eqId(tbl.key, key),
      columns: { id: true }
    });
    return { available: !conflict, key };
  });

const add_new_project_route = protectedAdminProcedure
  .input(
    z.object({
      name: z.string().trim().min(1).max(300),
      name_dev: z.string().trim().min(1).max(300),
      description: z.string().max(5000).optional().nullable(),
      slug: z.string().trim().min(1).max(100)
    })
  )
  .mutation(async ({ input: { name, name_dev, description, slug }, ctx: { cookie } }) => {
    await delay_dev(400);
    const key = lekhaUrlSlugify(slug);
    if (!key) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'Slug must contain at least one alphanumeric character'
      });
    }

    const project = await db.transaction(async (tx) => {
      const conflict = await tx.query.projects.findFirst({
        where: (tbl, { eq: eqId }) => eqId(tbl.key, key),
        columns: { id: true }
      });
      if (conflict) {
        throw new TRPCError({ code: 'CONFLICT', message: 'This slug is already in use' });
      }

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
      return inserted;
    });

    await invalidate_project_list_caches(cookie);
    return { success: true as const, project };
  });

export const project_edit_router = t.router({
  update_name_description: update_project_name_description_route,
  edit_project_slug: edit_project_slug_route,
  update_listed: update_project_listed_route,
  get_delete_resource_counts: get_delete_resource_counts_route,
  delete_project: delete_project_route,
  check_project_slug: check_project_slug_route,
  add_new_project: add_new_project_route
});
