import type { Handle } from '@sveltejs/kit';
import { auth, ALLOWED_ORIGINS } from '$lib/auth'; // path to your auth file
import { svelteKitHandler } from 'better-auth/svelte-kit';
import { createTRPCHandle } from 'trpc-sveltekit';
import { router } from '~/api/trpc_router';
import { createContext } from '~/api/context';
import { building } from '$app/environment';

export const handle_trpc: Handle = createTRPCHandle({ router, createContext });

export const handle: Handle = async ({ event, resolve }) => {
  const origin = event.request.headers.get('origin');
  const isAllowedOrigin = !!origin && ALLOWED_ORIGINS.includes(origin);

  const CORS_ALLOWED_URLS = ['/api/auth', '/api/ext'];
  const IS_CORS_ALLOWED_URL = CORS_ALLOWED_URLS.some((url) => event.url.pathname.startsWith(url));
  // Required for CORS to work
  if (IS_CORS_ALLOWED_URL && event.request.method === 'OPTIONS' && isAllowedOrigin) {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, PATCH, OPTIONS',
        'Access-Control-Allow-Headers':
          'Content-Type, Authorization, X-Requested-With, X-Captcha-Response',
        'Access-Control-Allow-Credentials': 'true',
        'Access-Control-Allow-Origin': origin,
        Vary: 'Origin'
      }
    });
  }
  if (event.url.pathname.startsWith('/trpc')) {
    return handle_trpc({ event, resolve });
  }
  const res: Response = await svelteKitHandler({ event, resolve, auth, building });
  if (IS_CORS_ALLOWED_URL && isAllowedOrigin) {
    res.headers.append('Access-Control-Allow-Origin', origin);
    res.headers.append('Access-Control-Allow-Credentials', 'true');
    res.headers.append('Vary', 'Origin');
  }
  return res;
};

// buffer pollyfill for netlify
import { Buffer } from 'buffer';
if (typeof globalThis.Buffer === 'undefined') {
  globalThis.Buffer = Buffer;
}
