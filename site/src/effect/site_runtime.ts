/**
 * Astro composition root for Effect (site).
 * Merges `process.env` + `import.meta.env` here only — services get resolved strings.
 * Lazy init avoids build-analysis / cold-start failures when secrets are absent.
 *
 * Site `tsconfig` remaps app `~/` prefixes used inside `$app/*` sources while keeping
 * site-owned `~/effect/site_runtime`, `~/lib/*`, `~/components/*`, and `~/utils/text-routes`.
 */
import { Effect, type ManagedRuntime } from 'effect';
import { resolveDbUrl, SharedConfig, type SharedConfigInput } from '$app/effect/config';
import { envBagFromUnknown, pickEnv } from '$app/effect/env';
import { createRunners, type EffectRunners } from '$app/effect/run';
import { makeSiteRuntime, type SiteRuntime } from '$app/effect/runtime';

type SiteRuntimeServices =
  SiteRuntime extends ManagedRuntime.ManagedRuntime<infer R, infer _E> ? R : never;
type SiteRuntimeError =
  SiteRuntime extends ManagedRuntime.ManagedRuntime<infer _R, infer E> ? E : never;
type SiteRunners = EffectRunners<SiteRuntimeServices, SiteRuntimeError>;

export const loadSiteConfigInput = (): SharedConfigInput => {
  // Public / Vite bag first, then process.env (server secrets on Astro/Vercel).
  const v = pickEnv(envBagFromUnknown(import.meta.env));
  return {
    dbUrl:
      resolveDbUrl({
        DB_MODE: v('DB_MODE'),
        PG_DATABASE_URL: v('PG_DATABASE_URL'),
        PG_DATABASE_URL1: v('PG_DATABASE_URL1'),
        PG_DATABASE_URL2: v('PG_DATABASE_URL2')
      }) ?? '',
    upstashRedisUrl: v('UPSTASH_REDIS_REST_URL') ?? '',
    upstashRedisToken: v('UPSTASH_REDIS_REST_TOKEN') ?? '',
    betterAuthUrl: v('VITE_BETTER_AUTH_URL') ?? '',
    isDev: Boolean(import.meta.env.DEV),
    isProd: Boolean(import.meta.env.PROD)
  };
};

let _runtime: SiteRuntime | undefined;
let _runners: SiteRunners | undefined;

const getCached = (): { runtime: SiteRuntime; runners: SiteRunners } => {
  if (!_runtime || !_runners) {
    _runtime = makeSiteRuntime(loadSiteConfigInput());
    _runners = createRunners(_runtime);
  }
  return { runtime: _runtime, runners: _runners };
};

export const getSiteRuntime = (): SiteRuntime => getCached().runtime;

export const getSiteBetterAuthUrl = (): string =>
  getCached().runtime.runSync(
    Effect.gen(function* () {
      const shared = yield* SharedConfig;
      return shared.betterAuthUrl;
    })
  );

export const runServerEffect = <A, E, R extends SiteRuntimeServices>(
  effect: Effect.Effect<A, E, R>
): Promise<A> => getCached().runners.runServerEffect(effect);

export const runRouteEffect = <A, E, R extends SiteRuntimeServices>(
  effect: Effect.Effect<A, E, R>,
  options?: {
    onSuccess?: (value: A) => Response;
  }
): Promise<Response> => getCached().runners.runRouteEffect(effect, options);
