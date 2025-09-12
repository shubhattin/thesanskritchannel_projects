import type { Context } from './context';
import { TRPCError, initTRPC } from '@trpc/server';
import transformer from './transformer';
import { CURRENT_APP_SCOPE } from '~/state/data_types';
import { REDIS_CACHE_KEYS } from '~/db/redis';
import { redis } from '~/db/redis';
import { db } from '~/db/db';
import type { app_scope_type } from '~/db/auth-schema';
import ms from 'ms';

export const t = initTRPC.context<Context>().create({
  transformer
});

export const publicProcedure = t.procedure;

export const protectedProcedure = publicProcedure.use(async function isAuthed({
  next,
  ctx: { user }
}) {
  if (!user) throw new TRPCError({ code: 'UNAUTHORIZED' });
  return next({
    ctx: { user }
  });
});

export const protectedAppScopeProcedure = protectedProcedure.use(async function hasAppScope({
  next,
  ctx: { user }
}) {
  const is_current_app_scope = await get_user_app_scope(user.id, CURRENT_APP_SCOPE);
  if (!is_current_app_scope)
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'Permission Denied for the provided app scope'
    });
  return next({
    ctx: { user }
  });
});

export const protectedAdminProcedure = protectedProcedure.use(async function isAuthed({
  next,
  ctx: { user }
}) {
  if (user.role !== 'admin')
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Not a Admin User' });
  return next({
    ctx: { user }
  });
});

export const get_user_app_scope = async (user_id: string, scope_name: app_scope_type) => {
  const cache = await redis.get<boolean>(REDIS_CACHE_KEYS.user_app_scope(user_id, scope_name));
  if (cache !== null && cache !== undefined) return Boolean(cache);

  const app_scope = await db.query.user_app_scope_join.findFirst({
    where: (tbl, { eq, and }) => and(eq(tbl.user_id, user_id), eq(tbl.scope, scope_name))
  });
  // store cache
  await redis.set(REDIS_CACHE_KEYS.user_app_scope(user_id, scope_name), !!app_scope, {
    ex: ms('15days') / 1000
  });

  return !!app_scope;
};
