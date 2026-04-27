import type { RequestHandler } from './$types';
import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import { router } from '~/api/trpc_router';
import { createContext } from '~/api/context';

export const GET: RequestHandler = (event) => {
  return fetchRequestHandler({
    endpoint: '/trpc',
    req: event.request,
    router,
    createContext: (e) => createContext(e)
  });
};
