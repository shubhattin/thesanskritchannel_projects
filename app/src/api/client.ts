import type { Router } from '~/api/trpc_router';
import { httpBatchLink as httpBatchLink_trpc, createTRPCClient } from '@trpc/client';
import transformer from './transformer';
import { createTRPCSvelte, httpBatchLink } from 'trpc-svelte-query';

export const client = createTRPCClient<Router>({
  links: [
    httpBatchLink_trpc({
      url: '/trpc',
      transformer
    })
  ]
});
export const client_q = createTRPCSvelte<Router>({
  links: [
    httpBatchLink({
      url: '/trpc',
      transformer
    })
  ]
});
