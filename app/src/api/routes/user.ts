import { z } from 'zod';
import { protectedAdminProcedure, protectedProcedure } from '../trpc_init';
import { db } from '~/db/db';
import { delay } from '~/tools/delay';
import { user_project_join, user_project_language_join } from '~/db/schema';
import { eq } from 'drizzle-orm';
import { t } from '../trpc_init';
import { get_languages_for_project_user } from './project';
import { fetch_post } from '~/tools/fetch';
import { PUBLIC_BETTER_AUTH_URL } from '$env/static/public';
import { APP_SCOPE_ID_LEKHA, APP_SCOPE_ID_PROJECT_PORTAL } from '~/state/data_types';

const get_user_info_route = protectedProcedure
  .input(z.object({ user_id: z.string() }))
  .query(async ({ input: { user_id }, ctx: { user, cookie } }) => {
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
        const languages = await get_languages_for_project_user(
          user_id,
          project_info.project_id,
          db
        );
        return {
          ...project_info,
          langugae_ids: languages.map((lang) => lang.lang_id)
        };
      })
    );

    return { projects };
  });

const remove_user_from_app_scope_route = protectedAdminProcedure
  .input(
    z.object({
      user_id: z.string(),
      scope: z.enum([APP_SCOPE_ID_PROJECT_PORTAL, APP_SCOPE_ID_LEKHA])
    })
  )
  .mutation(async ({ input: { user_id, scope }, ctx: { cookie } }) => {
    const res = await fetch_post(`${PUBLIC_BETTER_AUTH_URL}/api/app_scope/remove_user_app_scope`, {
      json: {
        user_id: user_id,
        scope
      },
      headers: {
        Cookie: cookie!
      }
    });
    if (!res.ok) return { success: false };

    if (scope === APP_SCOPE_ID_PROJECT_PORTAL) {
      await db.transaction(async (tx) => {
        await Promise.all([
          tx.delete(user_project_join).where(eq(user_project_join.user_id, user_id)),
          tx
            .delete(user_project_language_join)
            .where(eq(user_project_language_join.user_id, user_id))
        ]);
      });
    }

    return { success: true };
  });

export const user_router = t.router({
  user_info: get_user_info_route,
  remove_user_from_app_scope: remove_user_from_app_scope_route
});
