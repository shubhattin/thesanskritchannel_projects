import type { Context } from './context';
import { TRPCError, initTRPC } from '@trpc/server';
import transformer from './transformer';
import { APP_SCOPE } from '~/state/data_types';
import { get_user_app_scope } from './routes/app_scope';

export const t = initTRPC.context<Context>().create({
  transformer
});

export const publicProcedure = t.procedure;

export const protectedUnverifiedProcedure = publicProcedure.use(async function isAuthed({
  next,
  ctx: { user }
}) {
  if (!user) throw new TRPCError({ code: 'UNAUTHORIZED' });
  return next({
    ctx: { user }
  });
});

export const protectedAppScopeProcedure = protectedUnverifiedProcedure.use(async function isAuthed({
  next,
  ctx: { user }
}) {
  const is_current_app_scope = await get_user_app_scope(user.id, APP_SCOPE);
  if (!is_current_app_scope)
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'Permission Denied for the provided app scope'
    });
  return next({
    ctx: { user }
  });
});

export const protectedAdminProcedure = protectedUnverifiedProcedure.use(async function isAuthed({
  next,
  ctx: { user }
}) {
  if (user.role !== 'admin')
    throw new TRPCError({ code: 'UNAUTHORIZED', message: 'Not a Admin User' });
  return next({
    ctx: { user }
  });
});
