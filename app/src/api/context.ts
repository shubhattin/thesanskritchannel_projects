import get_session_from_cookie from '$lib/get_auth_from_cookie';
import type { FetchCreateContextFnOptions } from '@trpc/server/adapters/fetch';
import type { RequestEvent } from '@sveltejs/kit';

export const createContext = async (event: RequestEvent | FetchCreateContextFnOptions) => {
  const request = 'request' in event ? event.request : event.req;
  const cookie = request.headers.get('cookie') ?? '';
  const session = await get_session_from_cookie(cookie);
  const user = session?.user;

  return {
    user,
    cookie
  };
};

export type Context = Awaited<ReturnType<typeof createContext>>;
