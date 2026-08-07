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
import { createRunners, type EffectRunners } from '$app/effect/run';
import { makeSiteRuntime, type SiteRuntime } from '$app/effect/runtime';

type SiteRuntimeServices =
  SiteRuntime extends ManagedRuntime.ManagedRuntime<infer R, infer _E> ? R : never;
type SiteRuntimeError =
  SiteRuntime extends ManagedRuntime.ManagedRuntime<infer _R, infer E> ? E : never;
type SiteRunners = EffectRunners<SiteRuntimeServices, SiteRuntimeError>;

const nonEmpty = (value: string | undefined): string | undefined =>
  value !== undefined && value !== '' ? value : undefined;

const fromMeta = (value: unknown): string | undefined =>
  typeof value === 'string' ? nonEmpty(value) : undefined;

export const loadSiteConfigInput = (): SharedConfigInput => {
  const meta = import.meta.env;
  const dbUrl = resolveDbUrl({
    DB_MODE: process.env.DB_MODE ?? fromMeta(meta.DB_MODE),
    PG_DATABASE_URL: process.env.PG_DATABASE_URL ?? fromMeta(meta.PG_DATABASE_URL),
    PG_DATABASE_URL1: process.env.PG_DATABASE_URL1 ?? fromMeta(meta.PG_DATABASE_URL1),
    PG_DATABASE_URL2: process.env.PG_DATABASE_URL2 ?? fromMeta(meta.PG_DATABASE_URL2)
  });

  return {
    dbUrl: dbUrl ?? '',
    upstashRedisUrl:
      nonEmpty(process.env.UPSTASH_REDIS_REST_URL) ?? fromMeta(meta.UPSTASH_REDIS_REST_URL) ?? '',
    upstashRedisToken:
      nonEmpty(process.env.UPSTASH_REDIS_REST_TOKEN) ??
      fromMeta(meta.UPSTASH_REDIS_REST_TOKEN) ??
      '',
    betterAuthUrl:
      fromMeta(meta.VITE_BETTER_AUTH_URL) ?? nonEmpty(process.env.VITE_BETTER_AUTH_URL) ?? '',
    isDev: Boolean(meta.DEV),
    isProd: Boolean(meta.PROD)
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
