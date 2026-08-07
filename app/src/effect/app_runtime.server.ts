/**
 * SvelteKit composition root for Effect.
 * Reads `$env/*` / `import.meta.env` here only — services receive resolved strings.
 *
 * Lazy init: SvelteKit postbuild analyse runs with empty `$env/dynamic/private`;
 * constructing the runtime at module load would fail Schema validation.
 */
import { env } from '$env/dynamic/private';
import {
  PUBLIC_AWS_CLOUDFRONT_URL,
  PUBLIC_BETTER_AUTH_URL,
  PUBLIC_LOCAL_CONFIG,
  PUBLIC_TURNSTILE_SITE_KEY
} from '$env/static/public';
import { Effect, type ManagedRuntime } from 'effect';
import {
  AppPublicConfig,
  resolveDbUrl,
  type AppConfigInput,
  type AppPublicConfigInput,
  type AppPublicConfigShape
} from './config';
import { createRunners, type EffectRunners } from './run';
import { makeAppRuntime, type AppRuntime } from './runtime';

type AppRuntimeServices =
  AppRuntime extends ManagedRuntime.ManagedRuntime<infer R, infer _E> ? R : never;
type AppRuntimeError =
  AppRuntime extends ManagedRuntime.ManagedRuntime<infer _R, infer E> ? E : never;
type AppRunners = EffectRunners<AppRuntimeServices, AppRuntimeError>;

const nonEmpty = (value: string | undefined): string | undefined =>
  value !== undefined && value !== '' ? value : undefined;

const viteString = (value: unknown): string | undefined =>
  typeof value === 'string' ? nonEmpty(value) : undefined;

const parseOptionalBoolean = (value: string | undefined): boolean | undefined => {
  if (value === undefined || value === '') return undefined;
  return value === 'true';
};

export const loadAppConfigInput = (): AppConfigInput => {
  const dbUrl = resolveDbUrl({
    DB_MODE: process.env.DB_MODE,
    PG_DATABASE_URL: nonEmpty(process.env.PG_DATABASE_URL) ?? nonEmpty(env.PG_DATABASE_URL),
    PG_DATABASE_URL1: nonEmpty(process.env.PG_DATABASE_URL1) ?? nonEmpty(env.PG_DATABASE_URL1),
    PG_DATABASE_URL2: process.env.PG_DATABASE_URL2
  });

  return {
    dbUrl: dbUrl ?? '',
    upstashRedisUrl:
      nonEmpty(process.env.UPSTASH_REDIS_REST_URL) ?? nonEmpty(env.UPSTASH_REDIS_REST_URL) ?? '',
    upstashRedisToken:
      nonEmpty(process.env.UPSTASH_REDIS_REST_TOKEN) ??
      nonEmpty(env.UPSTASH_REDIS_REST_TOKEN) ??
      '',
    betterAuthUrl: nonEmpty(PUBLIC_BETTER_AUTH_URL) ?? '',
    isDev: import.meta.env.DEV,
    isProd: import.meta.env.PROD,
    awsRegion: nonEmpty(process.env.AWS_REGION) ?? nonEmpty(env.AWS_REGION) ?? '',
    awsAccessKeyId:
      nonEmpty(process.env.AWS_ACCESS_KEY_ID) ?? nonEmpty(env.AWS_ACCESS_KEY_ID) ?? '',
    awsSecretAccessKey:
      nonEmpty(process.env.AWS_SECRET_ACCESS_KEY) ?? nonEmpty(env.AWS_SECRET_ACCESS_KEY) ?? '',
    awsS3BucketName:
      nonEmpty(process.env.AWS_S3_FILES_BUCKET_NAME) ??
      nonEmpty(env.AWS_S3_FILES_BUCKET_NAME) ??
      '',
    openaiApiKey: nonEmpty(process.env.OPENAI_API_KEY) ?? nonEmpty(env.OPENAI_API_KEY) ?? '',
    openrouterApiKey:
      nonEmpty(process.env.OPENROUTER_API_KEY) ?? nonEmpty(env.OPENROUTER_API_KEY) ?? '',
    qstashToken: nonEmpty(process.env.QSTASH_TOKEN) ?? nonEmpty(env.QSTASH_TOKEN) ?? '',
    qstashCurrentSigningKey:
      nonEmpty(process.env.QSTASH_CURRENT_SIGNING_KEY) ??
      nonEmpty(env.QSTASH_CURRENT_SIGNING_KEY) ??
      '',
    qstashNextSigningKey:
      nonEmpty(process.env.QSTASH_NEXT_SIGNING_KEY) ?? nonEmpty(env.QSTASH_NEXT_SIGNING_KEY) ?? '',
    qstashBaseUrl:
      nonEmpty(process.env.QSTASH_URL) ??
      nonEmpty(env.QSTASH_URL) ??
      nonEmpty(process.env.QSTASH_BASE_URL),
    siteUrl: viteString(import.meta.env.VITE_SITE_URL) ?? '',
    mainSiteUrl: viteString(import.meta.env.VITE_MAIN_SITE_URL) ?? '',
    cloudfrontUrl: nonEmpty(PUBLIC_AWS_CLOUDFRONT_URL) ?? '',
    isQstashEnabled: import.meta.env.PROD,
    turnstileSecretKey:
      nonEmpty(process.env.TURNSTILE_SECRET_KEY) ?? nonEmpty(env.TURNSTILE_SECRET_KEY)
  };
};

export const loadPublicConfigInput = (): AppPublicConfigInput => ({
  betterAuthUrl: nonEmpty(PUBLIC_BETTER_AUTH_URL) ?? '',
  cloudfrontUrl: nonEmpty(PUBLIC_AWS_CLOUDFRONT_URL) ?? '',
  siteUrl: viteString(import.meta.env.VITE_SITE_URL) ?? '',
  mainSiteUrl: viteString(import.meta.env.VITE_MAIN_SITE_URL) ?? '',
  turnstileSiteKey: nonEmpty(PUBLIC_TURNSTILE_SITE_KEY),
  localConfig: parseOptionalBoolean(PUBLIC_LOCAL_CONFIG)
});

let _runtime: AppRuntime | undefined;
let _runners: AppRunners | undefined;

const getCached = (): { runtime: AppRuntime; runners: AppRunners } => {
  if (!_runtime || !_runners) {
    _runtime = makeAppRuntime(loadAppConfigInput(), loadPublicConfigInput());
    _runners = createRunners(_runtime);
  }
  return { runtime: _runtime, runners: _runners };
};

export const getAppRuntime = (): AppRuntime => getCached().runtime;

export const getAppPublicConfig = (): AppPublicConfigShape =>
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
