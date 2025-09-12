import { z } from 'zod';
import { protectedAdminProcedure, protectedUnverifiedProcedure } from '../trpc_init';
import { db } from '~/db/db';
import { delay } from '~/tools/delay';
import { user_project_join, user_project_language_join } from '~/db/schema';
import { and, eq } from 'drizzle-orm';
import { t } from '../trpc_init';
import { redis, REDIS_CACHE_KEYS, deleteKeysWithPattern } from '~/db/redis';
import ms from 'ms';

export const get_languages_for_ptoject_user = async (user_id: string, project_id: number) => {
  const cache = await redis.get<{ lang_id: number }[]>(
    REDIS_CACHE_KEYS.user_project_info(user_id, project_id)
  );
  if (cache) return cache;

  const langugaes = await db
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

  await redis.set(REDIS_CACHE_KEYS.user_project_info(user_id, project_id), langugaes, {
    ex: ms('20days') / 1000
  });

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
    await Promise.all([
      db
        .delete(user_project_join)
        .where(
          and(eq(user_project_join.user_id, user_id), eq(user_project_join.project_id, project_id))
        ),
      // deleting the user project language assigned as well
      db
        .delete(user_project_language_join)
        .where(
          and(
            eq(user_project_language_join.user_id, user_id),
            eq(user_project_language_join.project_id, project_id)
          )
        ),
      // delete any cached items
      deleteKeysWithPattern(REDIS_CACHE_KEYS.user_project_info(user_id, '*'))
    ]);

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
    const languages_current = await get_languages_for_ptoject_user(user_id, project_id);

    await Promise.allSettled([
      // deleting
      ...languages_current.map((lang) => {
        const exists = languages_id.find((id) => id === lang.lang_id);
        if (!exists)
          return db
            .delete(user_project_language_join)
            .where(
              and(
                eq(user_project_language_join.user_id, user_id),
                eq(user_project_language_join.project_id, project_id),
                eq(user_project_language_join.language_id, lang.lang_id)
              )
            );
      }),
      // inserting
      ...languages_id.map((lang_id) => {
        const exists = languages_current.find((lang) => lang.lang_id === lang_id);
        if (!exists)
          return db.insert(user_project_language_join).values({
            user_id,
            project_id,
            language_id: lang_id
          });
      })
    ]);
    await Promise.allSettled([redis.del(REDIS_CACHE_KEYS.user_project_info(user_id, project_id))]);

    return { success: true };
  });

export const user_project_info_route = protectedUnverifiedProcedure
  .input(
    z.object({
      project_id: z.number().int()
    })
  )
  .query(async ({ input: { project_id }, ctx: { user } }) => {
    await delay(550);

    const languages = await get_languages_for_ptoject_user(user.id, project_id);
    return { languages };
  });

export const project_router = t.router({
  add_to_project: add_to_project_route,
  remove_from_project: remove_from_project_route,
  update_project_languages: update_project_languages_route,
  user_project_info: user_project_info_route
});
