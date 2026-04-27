import get_seesion_from_cookie from '$lib/get_auth_from_cookie';
import type { FetchCreateContextFnOptions } from '@trpc/server/adapters/fetch';

export const createContext = async (event: FetchCreateContextFnOptions) => {
  const cookie = event.req.headers.get('cookie') ?? '';
  const session = await get_seesion_from_cookie(cookie);
  const user = session?.user;

  return {
    user,
    cookie
  };
};

export type Context = Awaited<ReturnType<typeof createContext>>;
