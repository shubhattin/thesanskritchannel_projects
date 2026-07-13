import type { Handle } from '@sveltejs/kit';
import '~/sync_private_env.server';

export const handle: Handle = async ({ event, resolve }) => {
  return await resolve(event);
};

// buffer pollyfill for netlify
import { Buffer } from 'buffer';
if (typeof globalThis.Buffer === 'undefined') {
  globalThis.Buffer = Buffer;
}
