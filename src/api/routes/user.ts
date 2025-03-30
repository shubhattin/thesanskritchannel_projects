import { z } from 'zod';
import { protectedAdminProcedure, protectedUnverifiedProcedure } from '../trpc_init';
import { db } from '~/db/db';
import { delay } from '~/tools/delay';
import { user, user_project_join } from '~/db/schema';
import { eq } from 'drizzle-orm';
import { t } from '../trpc_init';
import { auth } from '$lib/auth';
import { redis } from '~/db/redis';
import { get_languages_for_ptoject_user } from './project';

const get_user_info_route = protectedUnverifiedProcedure
  .input(z.object({ user_id: z.string() }))
  .query(async ({ input: { user_id }, ctx: { user } }) => {
    await delay(550);
    const is_approved = user.is_approved;

    if ((user.role !== 'admin' && user.id !== user_id) || !is_approved) {
      return { projects: [] };
    }

    const projects_info = await db
      .select({
        project_id: user_project_join.project_id
      })
      .from(user_project_join)
      .where(eq(user_project_join.user_id, user_id));

    const projects = await Promise.all(
      projects_info.map(async (project_info) => {
        const languages = await get_languages_for_ptoject_user(user_id, project_info.project_id);
        return {
          ...project_info,
          langugae_ids: languages.map((lang) => lang.lang_id)
        };
      })
    );

    return { projects };
  });

const list_users_route = protectedAdminProcedure.query(async ({ ctx: { user } }) => {
  await delay(550);
  const users = await db.query.user.findMany({
    columns: {
      id: true,
      name: true,
      email: true,
      role: true,
      is_approved: true
    },
    where: ({ id }, { ne }) => ne(id, user.id)
  });
  return users;
});

const remove_user_route = protectedAdminProcedure
  .input(z.object({ user_id: z.string() }))
  .mutation(async ({ input: { user_id }, ctx: { cookie } }) => {
    const { sessions } = await auth.api.listUserSessions({
      body: {
        userId: user_id
      },
      headers: {
        Cookie: cookie!
      }
    });
    await Promise.allSettled([
      ...sessions.map(async (session, i) => {
        await redis.del(session.token);
      }),
      db.delete(user).where(eq(user.id, user_id))
    ]);
    return { success: true };
  });

export const user_router = t.router({
  user_info: get_user_info_route,
  list_users: list_users_route,
  remove_user: remove_user_route
});
