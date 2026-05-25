import type { Context } from './context';
import { TRPCError, initTRPC } from '@trpc/server';
import transformer from './transformer';
import { APP_SCOPE_ID_LEKHA, APP_SCOPE_ID_PROJECT_PORTAL } from '~/state/data_types';
import { get_user_app_scope_status } from '~/utils/app_scope_utils.server';

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

/** For Projects Portal */
export const protectedAppScopeProcedure_ProjectsPortal = protectedProcedure.use(
  async function hasAppScope({ next, ctx: { user, cookie } }) {
    const is_current_app_scope =
      user.role !== 'admin'
        ? await get_user_app_scope_status(user.id, APP_SCOPE_ID_PROJECT_PORTAL, cookie)
        : true;
    if (!is_current_app_scope)
      throw new TRPCError({
        code: 'UNAUTHORIZED',
        message: 'Permission Denied for the provided app scope'
      });
    return next({
      ctx: { user }
    });
  }
);

/** For Lekha Portal */
export const protectedAppScopeProcedure_Lekha = protectedProcedure.use(async function hasAppScope({
  next,
  ctx: { user, cookie }
}) {
  const is_current_app_scope =
    user.role !== 'admin'
      ? await get_user_app_scope_status(user.id, APP_SCOPE_ID_LEKHA, cookie)
      : true;
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
