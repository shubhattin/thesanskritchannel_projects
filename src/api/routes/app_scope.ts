import { db } from '~/db/db';
import { redis, REDIS_CACHE_KEYS } from '~/db/redis';
import { protectedAdminProcedure, t } from '../trpc_init';
import { user_app_scope_join, type app_scope_type, AppScopeEnum } from '~/db/auth-schema';
import { z } from 'zod';
import { and, eq } from 'drizzle-orm';

export const get_user_app_scope = async (user_id: string, scope_name: app_scope_type) => {
  const cache = await redis.get<boolean>(REDIS_CACHE_KEYS.user_app_scope(user_id, scope_name));
  if (cache) return Boolean(cache);

  const app_scope = await db.query.user_app_scope_join.findFirst({
    where: (tbl, { eq, and }) => and(eq(tbl.user_id, user_id), eq(tbl.scope, scope_name))
  });

  return !!app_scope;
};

const get_user_app_scope_list_route = protectedAdminProcedure.query(async ({ ctx: { user } }) => {
  const app_scopes = await db.query.user_app_scope_join.findMany({
    where: (tbl, { eq }) => eq(tbl.user_id, user.id)
  });

  return app_scopes.map((scope) => scope.scope);
});

const add_user_app_scope_route = protectedAdminProcedure
  .input(
    z.object({
      user_id: z.string(),
      scope: AppScopeEnum
    })
  )
  .mutation(async ({ input: { scope, user_id } }) => {
    await db.insert(user_app_scope_join).values({ user_id, scope });
  });

const remove_user_app_scope_route = protectedAdminProcedure
  .input(
    z.object({
      user_id: z.string(),
      scope: AppScopeEnum
    })
  )
  .mutation(async ({ input: { scope, user_id } }) => {
    const deleted = await db
      .delete(user_app_scope_join)
      .where(and(eq(user_app_scope_join.user_id, user_id), eq(user_app_scope_join.scope, scope)));
    return { deleted };
  });

export const app_scope_router = t.router({
  get_user_app_scope_list: get_user_app_scope_list_route,
  add_user_app_scope: add_user_app_scope_route,
  remove_user_app_scope: remove_user_app_scope_route
});
