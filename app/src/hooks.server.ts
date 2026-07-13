import type { Handle } from '@sveltejs/kit';
import { env } from '$env/dynamic/private';

Object.assign(process.env, env);

export const handle: Handle = async ({ event, resolve }) => {
  return await resolve(event);
};

// buffer pollyfill for netlify
import { Buffer } from 'buffer';
if (typeof globalThis.Buffer === 'undefined') {
  globalThis.Buffer = Buffer;
}
