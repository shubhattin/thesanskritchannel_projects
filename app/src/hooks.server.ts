import type { Handle } from '@sveltejs/kit';

export const handle: Handle = async ({ event, resolve }) => {
  return await resolve(event);
};

// buffer pollyfill for netlify
import { Buffer } from 'buffer';
if (!('Buffer' in globalThis)) {
  globalThis.Buffer = Buffer;
}
