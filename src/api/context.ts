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

  return {
    user: session?.user
  };
}

export type Context = inferAsyncReturnType<typeof createContext>;
