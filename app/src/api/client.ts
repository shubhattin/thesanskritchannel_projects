import type { Router } from '~/api/trpc_router';
import { createTRPCClient, httpBatchLink } from '@trpc/client';
import { createTRPCContext, createTRPCOptionsProxy } from 'trpc-tanstack-svelte-query';
import { queryClient } from '~/state/queryClient';
import transformer from './transformer';

export const client = createTRPCClient<Router>({
  links: [
    httpBatchLink({
      url: '/api/trpc',
      transformer
    })
  ]
});

/** Module-level tRPC query helpers (e.g. queryFilter) outside Svelte components. */
export const trpc = createTRPCOptionsProxy<Router>({
  client,
  queryClient
});

export const { useTRPC, useTRPCClient } = createTRPCContext<Router>();
