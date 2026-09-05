/**
 * SvelteKit composition root for Effect.
 * Reads `$env/*` + `import.meta.env` here only — services receive resolved strings.
 *
 * One ManagedRuntime per Worker request (AsyncLocalStorage via `hooks.server.ts`).
 * Do not keep a process-wide runtime: Effect fibers/latches are isolate-global
 * and workerd drops continuations that settle in a different request.
 * waitUntil cache writes capture Redis/Database services, not this runtime.
 */
import { env } from '$env/dynamic/private';
import { env as publicEnv } from '$env/dynamic/public';
import { PUBLIC_AWS_CLOUDFRONT_URL, PUBLIC_BETTER_AUTH_URL } from '$env/static/public';
import { AsyncLocalStorage } from 'node:async_hooks';
import { Effect, type ManagedRuntime } from 'effect';
import {
  AppPublicConfig,
  resolveDbUrl,
  type AppConfigInput,
  type AppPublicConfigInput,
  type AppPublicConfigValue
} from './config';
import { envString, parseOptionalBoolean, pickEnv, type EnvBag } from './env';
import { createRunners, type EffectRunners } from './run';
// oxlint-disable-next-line anti-slop-effect/no-service-constructor-imports -- composition root: inputs are read from $env at the edge, so the runtime must be constructed here (not yielded from a Layer).
import { makeAppRuntime, type AppRuntime } from './runtime_app';

type AppRuntimeServices =
  AppRuntime extends ManagedRuntime.ManagedRuntime<infer R, infer _E> ? R : never;
type AppRuntimeError =
  AppRuntime extends ManagedRuntime.ManagedRuntime<infer _R, infer E> ? E : never;
type AppRunners = EffectRunners<AppRuntimeServices, AppRuntimeError>;

/** Client-safe / build-time values — searched before `$env/dynamic/private`. */
const publicBag = (): EnvBag => ({
  PUBLIC_BETTER_AUTH_URL,
  PUBLIC_AWS_CLOUDFRONT_URL,
  // Optional — absent / empty must not fail config decode
  PUBLIC_TURNSTILE_SITE_KEY: envString(publicEnv.PUBLIC_TURNSTILE_SITE_KEY),
  PUBLIC_LOCAL_CONFIG: envString(publicEnv.PUBLIC_LOCAL_CONFIG),
  VITE_SITE_URL: envString(import.meta.env.VITE_SITE_URL),
  VITE_MAIN_SITE_URL: envString(import.meta.env.VITE_MAIN_SITE_URL)
});

const get = () => pickEnv(publicBag(), env);

/** Empty-string default keeps the config Schema optional-string fields satisfied. */
const orEmpty = (value: string | undefined): string => value ?? '';

export const loadAppConfigInput = (): AppConfigInput => {
  const v = get();
  return {
    dbUrl: orEmpty(
      resolveDbUrl({
        DB_MODE: v('DB_MODE'),
        PG_DATABASE_URL: v('PG_DATABASE_URL'),
        PG_DATABASE_URL1: v('PG_DATABASE_URL1'),
        PG_DATABASE_URL2: v('PG_DATABASE_URL2')
      })
    ),
    upstashRedisUrl: orEmpty(v('UPSTASH_REDIS_REST_URL')),
    upstashRedisToken: orEmpty(v('UPSTASH_REDIS_REST_TOKEN')),
    betterAuthUrl: orEmpty(v('PUBLIC_BETTER_AUTH_URL')),
    isDev: import.meta.env.DEV,
    isProd: import.meta.env.PROD,
    awsRegion: orEmpty(v('AWS_REGION')),
    awsAccessKeyId: orEmpty(v('AWS_ACCESS_KEY_ID')),
    awsSecretAccessKey: orEmpty(v('AWS_SECRET_ACCESS_KEY')),
    awsS3BucketName: orEmpty(v('AWS_S3_FILES_BUCKET_NAME')),
    openaiApiKey: orEmpty(v('OPENAI_API_KEY')),
    openrouterApiKey: orEmpty(v('OPENROUTER_API_KEY')),
    qstashToken: orEmpty(v('QSTASH_TOKEN')),
    qstashCurrentSigningKey: orEmpty(v('QSTASH_CURRENT_SIGNING_KEY')),
    qstashNextSigningKey: orEmpty(v('QSTASH_NEXT_SIGNING_KEY')),
    qstashBaseUrl: orEmpty(v('QSTASH_URL')),
    siteUrl: orEmpty(v('VITE_SITE_URL')),
    mainSiteUrl: orEmpty(v('VITE_MAIN_SITE_URL')),
    cloudfrontUrl: orEmpty(v('PUBLIC_AWS_CLOUDFRONT_URL')),
    isQstashEnabled: import.meta.env.PROD,
    turnstileSecretKey: v('TURNSTILE_SECRET_KEY')
  };
};

export const loadPublicConfigInput = (): AppPublicConfigInput => {
  const v = get();
  return {
    betterAuthUrl: v('PUBLIC_BETTER_AUTH_URL') ?? '',
    cloudfrontUrl: v('PUBLIC_AWS_CLOUDFRONT_URL') ?? '',
    siteUrl: v('VITE_SITE_URL') ?? '',
    mainSiteUrl: v('VITE_MAIN_SITE_URL') ?? '',
    turnstileSiteKey: v('PUBLIC_TURNSTILE_SITE_KEY'),
    localConfig: parseOptionalBoolean(v('PUBLIC_LOCAL_CONFIG'))
  };
};

const loadRuntimeInputs = () => [loadAppConfigInput(), loadPublicConfigInput()] as const;

type AppScope = { runtime: AppRuntime; runners: AppRunners };

const appScope = new AsyncLocalStorage<AppScope>();

const createAppScope = (): AppScope => {
  const runtime = makeAppRuntime(...loadRuntimeInputs());
  return { runtime, runners: createRunners(runtime) };
};

/** Bind one Effect runtime to the current Worker request (see `hooks.server.ts`). */
export const runWithAppRuntime = <T>(fn: () => Promise<T>): Promise<T> =>
  appScope.run(createAppScope(), fn);

const getCached = (): AppScope => appScope.getStore() ?? createAppScope();

export const getAppRuntime = (): AppRuntime => getCached().runtime;

export const getAppPublicConfig = (): AppPublicConfigValue =>
  getCached().runtime.runSync(
    Effect.gen(function* () {
      return yield* AppPublicConfig;
    })
  );

export const runTrpcEffect = <A, E, R extends AppRuntimeServices>(
  effect: Effect.Effect<A, E, R>
): Promise<A> => getCached().runners.runTrpcEffect(effect);

export const runServerEffect = <A, E, R extends AppRuntimeServices>(
  effect: Effect.Effect<A, E, R>
): Promise<A> => getCached().runners.runServerEffect(effect);

export const runRouteEffect = <A, E, R extends AppRuntimeServices>(
  effect: Effect.Effect<A, E, R>,
  options?: {
    onSuccess?: (value: A) => Response;
  }
): Promise<Response> => getCached().runners.runRouteEffect(effect, options);

export const runQstashEffect = <A, E, R extends AppRuntimeServices>(
  effect: Effect.Effect<A, E, R>,
  options?: {
    onSuccess?: (value: A) => Response;
  }
): Promise<Response> => getCached().runners.runQstashEffect(effect, options);
