import get_seesion_from_cookie from '$lib/get_auth_from_cookie';
import type { inferAsyncReturnType } from '@trpc/server';
import type { RequestEvent } from '@sveltejs/kit';

export const createContext = async (event: RequestEvent) => {
  const cookie = event.request.headers.get('cookie') ?? '';
  const session = await get_seesion_from_cookie(cookie);
  const user = session?.user;

  return {
    user,
    cookie
  };
};

export type Context = inferAsyncReturnType<typeof createContext>;
