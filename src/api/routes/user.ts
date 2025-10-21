import { z } from 'zod';
import { protectedAdminProcedure, protectedProcedure } from '../trpc_init';
import { db } from '~/db/db';
import { delay } from '~/tools/delay';
import { user_project_join } from '~/db/schema';
import { eq } from 'drizzle-orm';
import { t } from '../trpc_init';
import { get_languages_for_ptoject_user } from './project';
import { get_user_app_scope_status } from '../trpc_init';
import { fetch_get, Fetch } from '~/tools/fetch';
import { PUBLIC_BETTER_AUTH_URL } from '$env/static/public';

const get_user_info_route = protectedProcedure
  .input(z.object({ user_id: z.string() }))
  .query(async ({ input: { user_id }, ctx: { user } }) => {
    await delay(550);

    if (user.role !== 'admin' && user.id !== user_id) {
      return { projects: [], current_app_scope: false };
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

    const current_app_scope = await get_user_app_scope_status(user_id);

    return { projects, current_app_scope };
  });

const list_users_route = protectedAdminProcedure.query(async ({ ctx: { user, cookie } }) => {
  await delay(550);
  type res_type = {
    email: string;
    id: string;
    name: string;
    role: string | null;
    app_scopes: {
      scope: string;
    }[];
  }[];
  const res = await fetch_get(`${PUBLIC_BETTER_AUTH_URL}/api/user/list_users`, {
    headers: {
      Cookie: cookie!
    },
    params: {
      user_id: user.id
    }
  });
  if (!res.ok) return [];
  const users = (await res.json()) as res_type;
  return users;
});

const remove_user_route = protectedAdminProcedure
  .input(z.object({ user_id: z.string() }))
  .mutation(async ({ input: { user_id }, ctx: { cookie } }) => {
    const res = await Fetch(`${PUBLIC_BETTER_AUTH_URL}/api/user/remove_user`, {
      method: 'DELETE',
      params: {
        user_id: user_id
      },
      headers: {
        Cookie: cookie!
      }
    });
    if (!res.ok) return { success: false };
    return { success: true };
  });

export const user_router = t.router({
  user_info: get_user_info_route,
  list_users: list_users_route,
  remove_user: remove_user_route
});
