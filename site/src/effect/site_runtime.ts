/**
 * Astro composition root for Effect (site).
 * Merges `process.env` + `import.meta.env` here only — services get resolved strings.
 * Lazy init avoids build-analysis / cold-start failures when secrets are absent.
 *
 * Site `tsconfig` remaps app `~/` prefixes used inside `$app/*` sources while keeping
 * site-owned `~/effect/site_runtime`, `~/lib/*`, `~/components/*`, and `~/utils/text-routes`.
 */
import { Cause, Effect, Exit, Layer, ManagedRuntime } from 'effect';
import { resolveDbUrl, SharedConfig, type SharedConfigInput } from '$app/effect/config';
import { envBagFromUnknown, pickEnv } from '$app/effect/env';
import { BackgroundWork } from '$app/effect/background';
import { Database } from '$app/effect/database';
import { RedisClient } from '$app/effect/redis';
import { createRunners, type EffectRunners } from '$app/effect/run';
import { BackgroundWorkLive } from './live/background';

const makeSiteLayer = (
  shared: SharedConfigInput,
  backgroundLayer: Layer.Layer<BackgroundWork>
) => {
  const sharedConfigLayer = SharedConfig.layer(shared);
  return Layer.mergeAll(Database.Live, RedisClient.Live, backgroundLayer).pipe(
    Layer.provideMerge(sharedConfigLayer)
  );
};

export const makeSiteRuntime = (
  shared: SharedConfigInput,
  backgroundLayer: Layer.Layer<BackgroundWork>
) => ManagedRuntime.make(makeSiteLayer(shared, backgroundLayer));

export type SiteRuntime = ReturnType<typeof makeSiteRuntime>;

type SiteRuntimeServices =
  SiteRuntime extends ManagedRuntime.ManagedRuntime<infer R, infer _E> ? R : never;
type SiteRuntimeError =
  SiteRuntime extends ManagedRuntime.ManagedRuntime<infer _R, infer E> ? E : never;
type SiteRunners = EffectRunners<SiteRuntimeServices, SiteRuntimeError>;

export const loadSiteConfigInput = (): SharedConfigInput => {
  // Public / Vite bag first, then process.env (Worker vars/secrets at runtime).
  const v = pickEnv(envBagFromUnknown(import.meta.env), process.env);
  const dbUrl =
    resolveDbUrl({
      DB_MODE: v('DB_MODE'),
      PG_DATABASE_URL: v('PG_DATABASE_URL'),
      PG_DATABASE_URL1: v('PG_DATABASE_URL1'),
      PG_DATABASE_URL2: v('PG_DATABASE_URL2')
    }) ?? '';
  const upstashRedisUrl = v('UPSTASH_REDIS_REST_URL') ?? '';
  const upstashRedisToken = v('UPSTASH_REDIS_REST_TOKEN') ?? '';
  // Site pages don't strictly need Better Auth; provide a dummy so SharedConfig
  // validation doesn't 500 public pages when VITE_BETTER_AUTH_URL is absent in prod.
  const betterAuthUrl = v('VITE_BETTER_AUTH_URL') ?? 'https://example.com';

  if (!dbUrl) console.error('[site] missing PG_DATABASE_URL (or DB_MODE variant)');
  if (!upstashRedisUrl || !upstashRedisToken)
    console.error('[site] missing UPSTASH_REDIS_REST_URL / TOKEN — cache will miss to DB');

  return {
    dbUrl: dbUrl ?? '',
    upstashRedisUrl: upstashRedisUrl ?? '',
    upstashRedisToken: upstashRedisToken ?? '',
    betterAuthUrl,
    isDev: Boolean(import.meta.env.DEV),
    isProd: Boolean(import.meta.env.PROD)
  };
};

let _siteRuntime: SiteRuntime | undefined;
let _runners: SiteRunners | undefined;

const getCached = () => {
  if (!_siteRuntime) {
    _siteRuntime = makeSiteRuntime(loadSiteConfigInput(), BackgroundWorkLive);
    _runners = createRunners(_siteRuntime);
  }
  return { runtime: _siteRuntime, runners: _runners! };
};

export const getSiteRuntime = (): SiteRuntime => getCached().runtime;

export const getSiteBetterAuthUrl = (): string =>
  getCached().runtime.runSync(
    Effect.gen(function* () {
      const shared = yield* SharedConfig;
      return shared.betterAuthUrl;
    })
  );

export const runServerEffect = async <A, E, R extends SiteRuntimeServices>(
  effect: Effect.Effect<A, E, R>
): Promise<A> => {
  return getCached().runners.runServerEffect(effect);
};

/**
 * Like runServerEffect but returns `fallback` on any failure instead of throwing.
 * Use for non-critical data (e.g. homepage lists) so a transient CacheError/DB
 * hiccup doesn't 500 the whole page in prod.
 * Warning is structured so log drains can alert on fallback usage.
 */
export const runServerEffectOr = async <A, E, R extends SiteRuntimeServices>(
  effect: Effect.Effect<A, E, R>,
  fallback: A
): Promise<A> => {
  const { runtime } = getCached();
  const exit = await runtime.runPromiseExit(
    effect.pipe(Effect.annotateLogs({ boundary: 'server', mode: 'fallback' }))
  );
  if (Exit.isSuccess(exit)) return exit.value;
  const pretty = Cause.pretty(exit.cause);
  console.warn('[site] runServerEffectOr: serving fallback', {
    cause: pretty,
    fallbackPreview: String(JSON.stringify(fallback)).slice(0, 500)
  });
  return fallback;
};

/**
 * Returns null on failure — useful for `resolve_text_route` where null means 404.
 */
export const runServerEffectNullable = async <A, E, R extends SiteRuntimeServices>(
  effect: Effect.Effect<A | null, E, R>
): Promise<A | null> => {
  const { runtime } = getCached();
  const exit = await runtime.runPromiseExit(
    effect.pipe(Effect.annotateLogs({ boundary: 'server', mode: 'nullable' }))
  );
  if (Exit.isSuccess(exit)) return exit.value;
  const pretty = Cause.pretty(exit.cause);
  console.warn('[site] runServerEffectNullable: returning null (404)', {
    cause: pretty,
    // SAFETY: `exit.cause` is an Effect `Cause` with no typed `stack` field; some
    // runtime representations expose one, and reading it here is best-effort log
    // output only — absence safely yields `undefined`.
    stack: (exit.cause as { stack?: string }).stack
  });
  return null;
};

export const runRouteEffect = <A, E, R extends SiteRuntimeServices>(
  effect: Effect.Effect<A, E, R>,
  options?: {
    onSuccess?: (value: A) => Response;
  }
): Promise<Response> => getCached().runners.runRouteEffect(effect, options);
