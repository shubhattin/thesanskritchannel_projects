import type { Router } from '~/api/trpc_router';
import { createTRPCClient, httpBatchLink } from '@trpc/client';
import { createTRPCContext } from 'trpc-tanstack-svelte-query';
import transformer from './transformer';

export const client = createTRPCClient<Router>({
  links: [
    httpBatchLink({
      url: '/api/trpc',
      transformer
    })
  ]
});

export const { useTRPC, useTRPCClient } = createTRPCContext<Router>();
