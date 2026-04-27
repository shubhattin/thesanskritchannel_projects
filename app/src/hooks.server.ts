import type { Handle } from '@sveltejs/kit';
import { createTRPCHandle } from 'trpc-sveltekit';
import { router } from '~/api/trpc_router';
import { createContext } from '~/api/context';

export const handle_trpc: Handle = createTRPCHandle({ router, createContext });

export const handle: Handle = async ({ event, resolve }) => {
  if (event.url.pathname.startsWith('/trpc')) {
    return handle_trpc({ event, resolve });
  }
  return await resolve(event);
};

// buffer pollyfill for netlify
import { Buffer } from 'buffer';
if (typeof globalThis.Buffer === 'undefined') {
  globalThis.Buffer = Buffer;
}
