import type { Handle, HandleServerError } from '@sveltejs/kit';
import { captureRequestError, withPosthogRequest } from '@app/effect/posthog.server';

export const handle: Handle = ({ event, resolve }) =>
  withPosthogRequest(event.request, 'site', () => resolve(event));

export const handleError: HandleServerError = ({ error, status, event }) =>
  captureRequestError(error, {
    status,
    request: event.request,
    source: 'handle',
    app: 'site'
  });
