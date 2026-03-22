import type { Context } from './context';
import { TRPCError, initTRPC } from '@trpc/server';
import transformer from './transformer';
import { CURRENT_APP_SCOPE } from '~/state/data_types';
import { fetch_get } from '~/tools/fetch';
import { PUBLIC_BETTER_AUTH_URL } from '$env/static/public';

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
  ctx: { user, cookie }
}) {
  const is_current_app_scope =
    user.role !== 'admin' ? await get_user_app_scope_status(user.id, cookie) : true;
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

export const get_user_app_scope_status = async (user_id: string, cookie: string) => {
  const res = await fetch_get(`${PUBLIC_BETTER_AUTH_URL}/api/app_scope/get_user_app_scope_status`, {
    params: {
      user_id,
      scope_name: CURRENT_APP_SCOPE
    },
    headers: {
      Cookie: cookie
    }
  });
  if (!res.ok) return false;
  return (await res.json()) ?? false;
};
