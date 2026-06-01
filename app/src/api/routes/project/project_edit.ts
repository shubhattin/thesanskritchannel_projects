import { TRPCError } from '@trpc/server';
import { count, eq } from 'drizzle-orm';
import { z } from 'zod';
import { protectedAdminProcedure, t } from '~/api/trpc_init';
import { db, type transactionType } from '~/db/db';
import {
  media_attachment,
  projects,
  texts,
  translations,
  user_project_join,
  user_project_language_join
} from '~/db/schema';
import { redis } from '~/db/redis';
import { REDIS_CACHE_KEYS_CLIENT } from '~/db/redis_shared';
import { lekhaUrlSlugify } from '~/lib/carta_markdown/markdown';
import { clear_project_map_cache, clear_project_server_cache } from '~/server/project_list.server';
import { delay } from '~/tools/delay';
import { type recursive_list_type, recursive_list_schema } from '~/state/data_types';

const project_id_input = z.object({
  project_id: z.int()
});

const invalidate_project_list_caches = async () => {
  clear_project_server_cache();
  if (import.meta.env.PROD) {
    await redis.del(REDIS_CACHE_KEYS_CLIENT.project_list());
  }
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
  .mutation(async ({ input }) => {
    await delay(400);
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

    await invalidate_project_list_caches();
    return { success: true };
  });

export const edit_project_slug_route = protectedAdminProcedure
  .input(
    project_id_input.extend({
      key: z.string().trim().min(1).max(100)
    })
  )
  .mutation(async ({ input }) => {
    await delay(400);
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

    await invalidate_project_list_caches();
    return { success: true };
  });

export const update_project_listed_route = protectedAdminProcedure
  .input(
    project_id_input.extend({
      listed: z.boolean()
    })
  )
  .mutation(async ({ input }) => {
    await delay(400);
    await db.transaction(async (tx) => {
      await require_project(tx, input.project_id);
      await tx
        .update(projects)
        .set({ listed: input.listed })
        .where(eq(projects.id, input.project_id));
    });

    await invalidate_project_list_caches();
    return { success: true };
  });

const get_delete_resource_counts_for_project = async (project_id: number) => {
  const count_rows_for_project = async (
    tx: transactionType,
    project_id: number,
    table:
      | typeof texts
      | typeof translations
      | typeof media_attachment
      | typeof user_project_join
      | typeof user_project_language_join
  ) => {
    const [row] = await tx
      .select({ count: count() })
      .from(table)
      .where(eq(table.project_id, project_id));
    return Number(row?.count ?? 0);
  };
  const [texts_count, translations_count, media_count, users_join_count, user_languages_count] =
    await Promise.all([
      count_rows_for_project(db, project_id, texts),
      count_rows_for_project(db, project_id, translations),
      count_rows_for_project(db, project_id, media_attachment),
      count_rows_for_project(db, project_id, user_project_join),
      count_rows_for_project(db, project_id, user_project_language_join)
    ]);

  return {
    texts: texts_count,
    translations: translations_count,
    media_attachment: media_count,
    user_project_join: users_join_count,
    user_project_language_join: user_languages_count,
    total: texts_count + translations_count + media_count + users_join_count + user_languages_count
  };
};

export const get_delete_resource_counts_route = protectedAdminProcedure
  .input(project_id_input)
  .query(async ({ input }) => {
    await delay(300);
    await require_project(db, input.project_id);
    return get_delete_resource_counts_for_project(input.project_id);
  });

export const delete_project_route = protectedAdminProcedure
  .input(project_id_input)
  .mutation(async ({ input }) => {
    await delay(400);
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

    clear_project_map_cache(input.project_id);
    await invalidate_project_list_caches();
    return { success: true as const };
  });

export const check_project_slug_route = protectedAdminProcedure
  .input(z.object({ slug: z.string().max(100) }))
  .query(async ({ input }) => {
    await delay(200);
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
  .mutation(async ({ input: { name, name_dev, description, slug } }) => {
    await delay(400);
    const key = lekhaUrlSlugify(slug);

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
              type: 'list',
              list_name: 'Level name'
            }
          } satisfies recursive_list_type)
        })
        .returning();
      return inserted;
    });

    await invalidate_project_list_caches();
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
