import { fetchRequestHandler } from '@trpc/server/adapters/fetch';
import { router } from '~/api/trpc_router';
import type { RequestHandler } from './$types';
import { createContext } from '~/api/context';

const handler: RequestHandler = (event) =>
	fetchRequestHandler({
		endpoint: '/api/trpc',
		req: event.request,
		router,
		createContext: async (event) => await createContext(event)
	});

export const GET = handler;
export const POST = handler;
