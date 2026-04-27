import type { Router } from '~/api/trpc_router';
import { httpBatchLink, createTRPCClient } from '@trpc/client';
import transformer from './transformer';
import { createTRPCSvelte } from 'trpc-svelte-query';

export const client = createTRPCClient<Router>({
  links: [
    httpBatchLink({
      url: '/api/trpc',
      transformer
    })
  ]
});
export const client_q = createTRPCSvelte<Router>({
  links: [
    httpBatchLink({
      url: '/api/trpc',
      transformer
    })
  ],
  // @ts-ignore
  transformer
});
