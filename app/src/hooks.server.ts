import type { Handle, HandleServerError } from '@sveltejs/kit';
import { captureRequestError, withPosthogRequest } from '~/effect/posthog.server';

export const handle: Handle = ({ event, resolve }) =>
  withPosthogRequest(event.request, 'admin', () => resolve(event));

export const handleError: HandleServerError = ({ error, status, event }) =>
  captureRequestError(error, {
    status,
    request: event.request,
    source: 'handle',
    app: 'admin'
  });

// buffer pollyfill for netlify
import { Buffer } from 'buffer';
if (!('Buffer' in globalThis)) {
  globalThis.Buffer = Buffer;
}
