import { z } from 'zod';
import { protectedAdminProcedure, protectedProcedure } from '../../trpc_init';
import { db, type transactionType } from '~/db/db';
import { delay } from '~/tools/delay';
import { projects, user_project_join, user_project_language_join } from '~/db/schema';
import { and, asc, count, eq, ilike, or } from 'drizzle-orm';
import { t } from '../../trpc_init';
import { redis, REDIS_CACHE_KEYS, deleteKeysWithPattern } from '~/db/redis';
import ms from 'ms';
import { waitUntil } from '@vercel/functions';
import { cache_db_options_app } from '~/server/cache_db_options';
import { get_project_list, get_project_map_by_id } from '~/server/project_list.server';
import { project_edit_router } from './project_edit';

export const get_languages_for_project_user = async (
  user_id: string,
  project_id: number,
  db_instance: transactionType
) => {
  const cache = await redis.get<{ lang_id: number }[]>(
    REDIS_CACHE_KEYS.user_project_info(user_id, project_id)
  );
  if (cache) return cache;

  const langugaes = await db_instance
    .select({
      lang_id: user_project_language_join.language_id
    })
    .from(user_project_language_join)
    .where(
      and(
        eq(user_project_language_join.user_id, user_id),
        eq(user_project_language_join.project_id, project_id)
      )
    );

  waitUntil(
    redis.set(REDIS_CACHE_KEYS.user_project_info(user_id, project_id), langugaes, {
      ex: ms('20days') / 1000
    })
  );

  return langugaes;
};

const add_to_project_route = protectedAdminProcedure
  .input(
    z.object({
      user_id: z.string(),
      project_id: z.int()
    })
  )
  .mutation(async ({ input: { user_id, project_id } }) => {
    await delay(400);
    await db.insert(user_project_join).values({
      user_id,
      project_id
    });

    return { success: true };
  });

const remove_from_project_route = protectedAdminProcedure
  .input(
    z.object({
      user_id: z.string(),
      project_id: z.int()
    })
  )
  .mutation(async ({ input }) => {
    const { user_id, project_id } = input;
    await db.transaction(async (tx) => {
      await Promise.all([
        tx
          .delete(user_project_join)
          .where(
            and(
              eq(user_project_join.user_id, user_id),
              eq(user_project_join.project_id, project_id)
            )
          ),
        // deleting the user project language assigned as well
        tx
          .delete(user_project_language_join)
          .where(
            and(
              eq(user_project_language_join.user_id, user_id),
              eq(user_project_language_join.project_id, project_id)
            )
          )
      ]);
    });
    await deleteKeysWithPattern(REDIS_CACHE_KEYS.user_project_info(user_id, '*'));

    return { success: true };
  });

const update_project_languages_route = protectedAdminProcedure
  .input(
    z.object({
      user_id: z.string(),
      project_id: z.int(),
      languages_id: z.int().array()
    })
  )
  .mutation(async ({ input }) => {
    const { user_id, project_id, languages_id } = input;
    await delay(400);
    await db.transaction(async (tx) => {
      const languages_current = await get_languages_for_project_user(user_id, project_id, tx);

      const current_set = new Set(languages_current.map((lang) => lang.lang_id));
      const target_set = new Set(languages_id);

      await Promise.all([
        // deletion
        ...languages_current
          .filter((lang) => !target_set.has(lang.lang_id))
          .map((lang) =>
            tx
              .delete(user_project_language_join)
              .where(
                and(
                  eq(user_project_language_join.user_id, user_id),
                  eq(user_project_language_join.project_id, project_id),
                  eq(user_project_language_join.language_id, lang.lang_id)
                )
              )
          ),
        // insertions
        ...Array.from(target_set)
          .filter((lang_id) => !current_set.has(lang_id))
          .map((lang_id) =>
            tx.insert(user_project_language_join).values({
              user_id,
              project_id,
              language_id: lang_id
            })
          )
      ]);
    });

    await redis.del(REDIS_CACHE_KEYS.user_project_info(user_id, project_id));

    return { success: true };
  });

export const user_project_info_route = protectedProcedure
  .input(
    z.object({
      project_id: z.int()
    })
  )
  .query(async ({ input: { project_id }, ctx: { user } }) => {
    await delay(550);

    const languages = await get_languages_for_project_user(user.id, project_id, db);
    return { languages };
  });

const get_project_list_input = z.object({
  /** When true, returns the full project list (for app-wide registry lookups). */
  all: z.boolean().default(false),
  page: z.int().min(1).default(1),
  size: z.int().min(1).max(100).default(15),
  search: z.string().max(500).optional(),
  /** When set, only projects with this listed value are returned. */
  listed: z.boolean().optional()
});

const get_project_list_route = protectedProcedure
  .input(get_project_list_input)
  .query(async ({ input, ctx: { user } }) => {
    const is_admin = user.role === 'admin';

    if (input.all) {
      const list = await get_project_list(
        cache_db_options_app,
        is_admin ? undefined : { listed_only: true }
      );
      return { list, total: list.length, page: 1, pageCount: 1, hasPrev: false, hasNext: false };
    }

    const trimmedSearch = input.search?.trim();
    const searchCondition = trimmedSearch
      ? or(
          ilike(projects.name, `%${trimmedSearch}%`),
          ilike(projects.name_dev, `%${trimmedSearch}%`),
          ilike(projects.description, `%${trimmedSearch}%`)
        )
      : undefined;
    const listedCondition = is_admin
      ? input.listed === undefined
        ? undefined
        : eq(projects.listed, input.listed)
      : eq(projects.listed, true);
    const whereClause = and(searchCondition, listedCondition);
    const offset = (input.page - 1) * input.size;

    const [countResult, list] = await Promise.all([
      db.select({ count: count() }).from(projects).where(whereClause),
      db
        .select({
          id: projects.id,
          name: projects.name,
          name_dev: projects.name_dev,
          description: projects.description,
          key: projects.key,
          listed: projects.listed
        })
        .from(projects)
        .where(whereClause)
        .orderBy(asc(projects.id))
        .limit(input.size)
        .offset(offset)
    ]);

    const total = Number(countResult[0]?.count ?? 0);
    const pageCount = Math.max(1, Math.ceil(total / input.size));

    return {
      list,
      total,
      page: input.page,
      pageCount,
      hasPrev: input.page > 1,
      hasNext: input.page < pageCount
    };
  });

const get_project_map_route = protectedProcedure
  .input(z.object({ project_id: z.int() }))
  .query(async ({ input: { project_id } }) => {
    return get_project_map_by_id(project_id, cache_db_options_app);
  });

export const project_router = t.router({
  add_to_project: add_to_project_route,
  remove_from_project: remove_from_project_route,
  update_project_languages: update_project_languages_route,
  user_project_info: user_project_info_route,
  get_project_list: get_project_list_route,
  get_project_map: get_project_map_route,
  edit: project_edit_router
});
