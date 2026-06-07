import type { Router } from '~/api/trpc_router';
import transformer from './transformer';

import { createTRPCClient, httpBatchLink } from '@trpc/client';
import { createTRPCContext } from 'trpc-tanstack-svelte-query';

export const client = createTRPCClient<Router>({
  links: [
    httpBatchLink({
      url: '/api/trpc',
      transformer
    })
  ]
});

export const { useTRPC, useTRPCClient } = createTRPCContext<Router>();

// const client_options = {
//   links: [
//     httpBatchLink({
//       url: '/trpc'
//     })
//   ],
//   transformer
// };

// export const client = createTRPCClient<Router>(client_options);
// export const client_q = createTRPCSvelte<Router>(client_options);
