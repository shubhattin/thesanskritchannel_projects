import { z } from 'zod';
import { protectedAdminProcedure, protectedProcedure } from '../trpc_init';
import { db, type transactionType } from '~/db/db';
import { delay } from '~/tools/delay';
import { user_project_join, user_project_language_join } from '~/db/schema';
import { and, eq } from 'drizzle-orm';
import { t } from '../trpc_init';
import { redis, REDIS_CACHE_KEYS, deleteKeysWithPattern } from '~/db/redis';
import ms from 'ms';
import { waitUntil } from '@vercel/functions';

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
      project_id: z.number().int()
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
      project_id: z.number().int()
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
      project_id: z.number().int(),
      languages_id: z.number().int().array()
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
        ...target_set
          .values()
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
      project_id: z.number().int()
    })
  )
  .query(async ({ input: { project_id }, ctx: { user } }) => {
    await delay(550);

    const languages = await get_languages_for_project_user(user.id, project_id, db);
    return { languages };
  });

export const project_router = t.router({
  add_to_project: add_to_project_route,
  remove_from_project: remove_from_project_route,
  update_project_languages: update_project_languages_route,
  user_project_info: user_project_info_route
});
