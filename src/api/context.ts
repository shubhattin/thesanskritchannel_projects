import type { RequestEvent } from '@sveltejs/kit';
import type { inferAsyncReturnType } from '@trpc/server';
import { auth } from '$lib/auth';

export async function createContext(event: RequestEvent) {
  const {
    request: { headers }
  } = event;

  const session = await auth.api.getSession({
    headers: headers
  });
  const cookie = headers.get('Cookie');

  return {
    user: session?.user,
    cookie
  };
}

export type Context = inferAsyncReturnType<typeof createContext>;
