import type { Handle } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';

/** To make process.env accessible too for environment variables */
Object.assign(process.env, env);

export const handle: Handle = async ({ event, resolve }) => {
  return await resolve(event);
};

// buffer pollyfill for netlify
import { Buffer } from 'buffer';
if (typeof globalThis.Buffer === 'undefined') {
  globalThis.Buffer = Buffer;
}
