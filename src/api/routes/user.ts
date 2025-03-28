import { z } from 'zod';
import {
  protectedProcedure,
  protectedAdminProcedure,
  protectedUnverifiedProcedure
} from '../trpc_init';
import { db } from '~/db/db';
import { delay } from '~/tools/delay';
import { user, user_project_join, user_project_language_join } from '~/db/schema';
import { and, eq } from 'drizzle-orm';
import { t } from '../trpc_init';

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
        const langugaes = await db
          .select({
            lang_id: user_project_language_join.language_id
          })
          .from(user_project_language_join)
          .where(
            and(
              eq(user_project_language_join.user_id, user_id),
              eq(user_project_language_join.project_id, project_info.project_id)
            )
          );
        return {
          ...project_info,
          langugae_ids: langugaes.map((lang) => lang.lang_id)
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

const approve_user_route = protectedAdminProcedure
  .input(z.object({ user_id: z.string() }))
  .mutation(async ({ input: { user_id } }) => {
    await db.update(user).set({ is_approved: true }).where(eq(user.id, user_id));
    return { success: true };
  });

const remove_user_route = protectedAdminProcedure
  .input(z.object({ user_id: z.string() }))
  .mutation(async ({ input: { user_id } }) => {
    await db.delete(user).where(eq(user.id, user_id));
    return { success: true };
  });

const edit_name_route = protectedProcedure
  .input(z.object({ name: z.string() }))
  .mutation(async ({ input, ctx }) => {
    const user_info = ctx.user;
    const { name } = input;
    await db.update(user).set({ name }).where(eq(user.id, user_info.id));
    return { success: true };
  });

export const user_router = t.router({
  user_info: get_user_info_route,
  list_users: list_users_route,
  approve_user: approve_user_route,
  remove_user: remove_user_route,
  edit_name: edit_name_route
});
