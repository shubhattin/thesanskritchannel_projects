import { AsyncLocalStorage } from 'node:async_hooks';
import type { Cause } from 'effect';
import { PostHog } from 'posthog-node';
import {
  asError,
  attachEffectCause,
  exceptionFromCause,
  isClientFailure,
  isReportableCause,
  readEffectCause,
  type EffectCauseSnapshot,
  type ExceptionProperties
} from './exception_report';

export type PosthogApp = 'admin' | 'site';

type RequestStore = {
  readonly request: Request;
  readonly app: PosthogApp;
};

type CaptureContext = {
  readonly source: string;
  readonly status?: number;
  readonly request?: Request;
  readonly app?: PosthogApp;
  readonly extra?: ExceptionProperties;
};

type PropertyEntry = [string, string | number];

type CaptureEntries = {
  readonly entries: PropertyEntry[];
  readonly distinctId?: string;
};

const requestStore = new AsyncLocalStorage<RequestStore>();
const reported = new WeakSet<Error>();

export const withPosthogRequest = <A>(request: Request, app: PosthogApp, fn: () => A): A =>
  requestStore.run({ request, app }, fn);

const markReported = (error: Error) => {
  reported.add(error);
};

const wasReported = (error: Error): boolean => reported.has(error);

const trimmed = (value: string | undefined): string | undefined => {
  if (value === undefined) return undefined;
  const text = value.trim();
  return text ? text : undefined;
};

const posthogKey = (): string | undefined => trimmed(import.meta.env.VITE_POSTHOG_KEY);

const posthogHost = (): string =>
  trimmed(import.meta.env.VITE_POSTHOG_URL) ?? 'https://us.i.posthog.com';

const trackingEnabled = (): boolean => import.meta.env.PROD && posthogKey() !== undefined;

let client: PostHog | undefined;

const getClient = (): PostHog | undefined => {
  const key = posthogKey();
  if (!import.meta.env.PROD || !key) return undefined;
  if (!client) client = new PostHog(key, { host: posthogHost() });
  return client;
};

const header = (request: Request, name: string): string | undefined =>
  trimmed(request.headers.get(name) ?? undefined);

const pushExtra = (entries: PropertyEntry[], extra: ExceptionProperties | undefined) => {
  if (!extra) return;
  if (extra.effect_cause) entries.push(['effect_cause', extra.effect_cause]);
  if (extra.effect_tag) entries.push(['effect_tag', extra.effect_tag]);
  if (extra.effect_fields) entries.push(['effect_fields', extra.effect_fields]);
};

const captureEntries = (context: CaptureContext): CaptureEntries => {
  const store = requestStore.getStore();
  const request = context.request ?? store?.request;
  const entries: PropertyEntry[] = [['boundary', context.source]];
  pushExtra(entries, context.extra);
  const app = context.app ?? store?.app;
  if (app) entries.push(['app', app]);
  if (context.status !== undefined) entries.push(['status', context.status]);
  if (!request) return { entries };
  const sessionId = header(request, 'x-posthog-session-id');
  if (sessionId) entries.push(['$session_id', sessionId]);
  entries.push(['path', new URL(request.url).pathname]);
  entries.push(['method', request.method]);
  return { entries, distinctId: header(request, 'x-posthog-distinct-id') };
};

const send = async (error: Error, context: CaptureContext): Promise<boolean> => {
  const posthog = getClient();
  if (!posthog) return false;
  const { entries, distinctId } = captureEntries(context);
  await posthog.captureExceptionImmediate(error, distinctId, Object.fromEntries(entries));
  return true;
};

/**
 * Captures a full Effect cause (pretty text, tag, nested cause) when error
 * tracking is enabled. No-ops in local dev and when the PostHog key is absent.
 * Returns whether the event was sent.
 */
export const reportEffectFailure = async (
  cause: Cause.Cause<unknown>,
  source: string,
  status?: number
): Promise<boolean> => {
  if (!trackingEnabled() || !isReportableCause(cause)) return false;
  try {
    const captured = exceptionFromCause(cause);
    return await send(captured.error, {
      source,
      status,
      extra: captured.properties
    });
  } catch (error) {
    console.error('[posthog] failed to capture effect error', error);
    return false;
  }
};

/**
 * Attaches the pretty cause to `thrown` for later hooks, reports server
 * failures, and marks expected 4xx / already-sent errors so `handleError`
 * does not send them again.
 */
export const trackEffectFailure = async (
  cause: Cause.Cause<unknown>,
  thrown: Error | undefined,
  source: string,
  status?: number
): Promise<void> => {
  if (thrown) attachEffectCause(thrown, cause);
  if (!isReportableCause(cause)) {
    if (thrown) markReported(thrown);
    return;
  }
  if ((await reportEffectFailure(cause, source, status)) && thrown) markReported(thrown);
};

const isNonEmptyMessage = (cause: unknown): cause is string =>
  typeof cause === 'string' && cause.length > 0;

const snapshotProperties = (snapshot: EffectCauseSnapshot): ExceptionProperties => {
  const properties: ExceptionProperties = { effect_cause: snapshot.pretty };
  if (snapshot.tag) properties.effect_tag = snapshot.tag;
  if (snapshot.fields) properties.effect_fields = snapshot.fields;
  return properties;
};

const errorFromSnapshot = (cause: unknown): Error => {
  const thrown = asError(cause);
  const snapshot = thrown ? readEffectCause(thrown) : undefined;
  if (!snapshot) {
    if (thrown) return thrown;
    if (isNonEmptyMessage(cause)) return new Error(cause);
    return new Error('Unexpected server error');
  }
  const wrapped = new Error(snapshot.message || snapshot.name || 'Effect failure');
  wrapped.name = snapshot.name || wrapped.name;
  if (thrown?.stack) wrapped.stack = thrown.stack;
  return wrapped;
};

/** SvelteKit `handleError` entry. Skips local dev, 404s, and errors already sent. */
export const captureRequestError = async (
  cause: unknown,
  input: { status: number; request: Request; source: string; app: PosthogApp }
): Promise<void> => {
  const thrown = asError(cause);
  if (!trackingEnabled() || input.status === 404 || isClientFailure(cause)) return;
  if (thrown && wasReported(thrown)) return;
  try {
    const snapshot = thrown ? readEffectCause(thrown) : undefined;
    await send(errorFromSnapshot(cause), {
      source: input.source,
      status: input.status,
      request: input.request,
      app: input.app,
      extra: snapshot ? snapshotProperties(snapshot) : undefined
    });
  } catch (captureError) {
    console.error('[posthog] failed to capture request error', captureError);
  }
};
