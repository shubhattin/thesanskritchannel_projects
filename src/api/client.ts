import type { Router } from '~/api/trpc_router';
import { httpBatchLink } from '@trpc/client';
import { createTRPCClient } from 'trpc-sveltekit';
import transformer from './transformer';
import { createTRPCSvelte } from 'trpc-svelte-query';

const client_options = {
  links: [
    httpBatchLink({
      url: '/trpc'
    })
  ],
  transformer
};

export const client = createTRPCClient<Router>(client_options);
export const client_q = createTRPCSvelte<Router>(client_options);
