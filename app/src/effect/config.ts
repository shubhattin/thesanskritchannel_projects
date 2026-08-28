import { Context, Effect, Layer, Redacted, Schema } from 'effect';
import { ConfigError } from './errors';

const NonEmptyString = Schema.String.check(Schema.isMinLength(1));

export type SharedConfigInput = {
  dbUrl: string;
  upstashRedisUrl: string;
  upstashRedisToken: string;
  betterAuthUrl: string;
  isDev: boolean;
  isProd: boolean;
};

export type AppConfigInput = SharedConfigInput & {
  awsRegion: string;
  awsAccessKeyId: string;
  awsSecretAccessKey: string;
  awsS3BucketName: string;
  openaiApiKey: string;
  openrouterApiKey: string;
  qstashToken: string;
  qstashCurrentSigningKey: string;
  qstashNextSigningKey: string;
  qstashBaseUrl: string;
  siteUrl: string;
  mainSiteUrl: string;
  cloudfrontUrl: string;
  isQstashEnabled: boolean;
  turnstileSecretKey?: string;
};

export type AppPublicConfigInput = {
  betterAuthUrl: string;
  cloudfrontUrl: string;
  siteUrl: string;
  mainSiteUrl: string;
  turnstileSiteKey?: string;
  localConfig?: boolean;
};

export type DbUrlEnv = {
  DB_MODE?: string;
  PG_DATABASE_URL?: string;
  PG_DATABASE_URL1?: string;
  PG_DATABASE_URL2?: string;
};

/** Resolve Postgres URL from DB_MODE for app runtime and Drizzle Kit scripts. */
export const resolveDbUrl = (env: DbUrlEnv): string | undefined => {
  if (env.DB_MODE === 'PROD') return env.PG_DATABASE_URL1;
  if (env.DB_MODE === 'PREVIEW') return env.PG_DATABASE_URL2;
  if (env.DB_MODE !== undefined && env.DB_MODE !== '') return undefined;
  return env.PG_DATABASE_URL;
};

const SharedConfigSchema = Schema.Struct({
  dbUrl: NonEmptyString,
  upstashRedisUrl: NonEmptyString,
  upstashRedisToken: NonEmptyString,
  betterAuthUrl: NonEmptyString,
  isDev: Schema.Boolean,
  isProd: Schema.Boolean
});

const AppConfigSchema = Schema.Struct({
  dbUrl: NonEmptyString,
  upstashRedisUrl: NonEmptyString,
  upstashRedisToken: NonEmptyString,
  betterAuthUrl: NonEmptyString,
  isDev: Schema.Boolean,
  isProd: Schema.Boolean,
  awsRegion: NonEmptyString,
  awsAccessKeyId: NonEmptyString,
  awsSecretAccessKey: NonEmptyString,
  awsS3BucketName: NonEmptyString,
  openaiApiKey: NonEmptyString,
  openrouterApiKey: NonEmptyString,
  qstashToken: NonEmptyString,
  qstashCurrentSigningKey: NonEmptyString,
  qstashNextSigningKey: NonEmptyString,
  qstashBaseUrl: NonEmptyString,
  siteUrl: NonEmptyString,
  mainSiteUrl: NonEmptyString,
  cloudfrontUrl: NonEmptyString,
  isQstashEnabled: Schema.Boolean,
  turnstileSecretKey: Schema.optional(NonEmptyString)
});

const AppPublicConfigSchema = Schema.Struct({
  betterAuthUrl: NonEmptyString,
  cloudfrontUrl: NonEmptyString,
  siteUrl: NonEmptyString,
  mainSiteUrl: NonEmptyString,
  turnstileSiteKey: Schema.optional(NonEmptyString),
  localConfig: Schema.optional(Schema.Boolean)
});

type SharedConfigDecoded = typeof SharedConfigSchema.Type;
type AppConfigDecoded = typeof AppConfigSchema.Type;
type AppPublicConfigDecoded = typeof AppPublicConfigSchema.Type;

type SharedRedactedKeys = 'dbUrl' | 'upstashRedisToken';

export type SharedConfigValue = Omit<SharedConfigDecoded, SharedRedactedKeys> & {
  readonly dbUrl: Redacted.Redacted<string>;
  readonly upstashRedisToken: Redacted.Redacted<string>;
};

type AppRedactedKeys =
  | SharedRedactedKeys
  | 'awsSecretAccessKey'
  | 'openaiApiKey'
  | 'openrouterApiKey'
  | 'qstashToken'
  | 'qstashCurrentSigningKey'
  | 'qstashNextSigningKey'
  | 'turnstileSecretKey';

export type AppConfigValue = Omit<AppConfigDecoded, AppRedactedKeys> & {
  readonly dbUrl: Redacted.Redacted<string>;
  readonly upstashRedisToken: Redacted.Redacted<string>;
  readonly awsSecretAccessKey: Redacted.Redacted<string>;
  readonly openaiApiKey: Redacted.Redacted<string>;
  readonly openrouterApiKey: Redacted.Redacted<string>;
  readonly qstashToken: Redacted.Redacted<string>;
  readonly qstashCurrentSigningKey: Redacted.Redacted<string>;
  readonly qstashNextSigningKey: Redacted.Redacted<string>;
  readonly turnstileSecretKey: Redacted.Redacted<string> | undefined;
};

export type AppPublicConfigValue = AppPublicConfigDecoded;

const failConfig = (message: string, cause: unknown) =>
  Effect.fail(ConfigError.make({ message, cause }));

const decodeShared = (input: SharedConfigInput) => {
  const parsed = Schema.decodeUnknownExit(SharedConfigSchema)(input);
  if (parsed._tag === 'Failure') {
    return failConfig('Invalid shared configuration', parsed.cause);
  }
  const data = parsed.value;
  return Effect.succeed({
    dbUrl: Redacted.make(data.dbUrl),
    upstashRedisUrl: data.upstashRedisUrl,
    upstashRedisToken: Redacted.make(data.upstashRedisToken),
    betterAuthUrl: data.betterAuthUrl,
    isDev: data.isDev,
    isProd: data.isProd
  } satisfies SharedConfigValue);
};

const decodeApp = (input: AppConfigInput) => {
  const parsed = Schema.decodeUnknownExit(AppConfigSchema)(input);
  if (parsed._tag === 'Failure') {
    return failConfig('Invalid application configuration', parsed.cause);
  }
  const data = parsed.value;
  return Effect.succeed({
    dbUrl: Redacted.make(data.dbUrl),
    upstashRedisUrl: data.upstashRedisUrl,
    upstashRedisToken: Redacted.make(data.upstashRedisToken),
    betterAuthUrl: data.betterAuthUrl,
    isDev: data.isDev,
    isProd: data.isProd,
    awsRegion: data.awsRegion,
    awsAccessKeyId: data.awsAccessKeyId,
    awsSecretAccessKey: Redacted.make(data.awsSecretAccessKey),
    awsS3BucketName: data.awsS3BucketName,
    openaiApiKey: Redacted.make(data.openaiApiKey),
    openrouterApiKey: Redacted.make(data.openrouterApiKey),
    qstashToken: Redacted.make(data.qstashToken),
    qstashCurrentSigningKey: Redacted.make(data.qstashCurrentSigningKey),
    qstashNextSigningKey: Redacted.make(data.qstashNextSigningKey),
    qstashBaseUrl: data.qstashBaseUrl,
    siteUrl: data.siteUrl,
    mainSiteUrl: data.mainSiteUrl,
    cloudfrontUrl: data.cloudfrontUrl,
    isQstashEnabled: data.isQstashEnabled,
    turnstileSecretKey: data.turnstileSecretKey ? Redacted.make(data.turnstileSecretKey) : undefined
  } satisfies AppConfigValue);
};

const decodePublic = (input: AppPublicConfigInput) => {
  const parsed = Schema.decodeUnknownExit(AppPublicConfigSchema)(input);
  if (parsed._tag === 'Failure') {
    return failConfig('Invalid public configuration', parsed.cause);
  }
  return Effect.succeed(parsed.value satisfies AppPublicConfigValue);
};

export class SharedConfig extends Context.Service<SharedConfig, SharedConfigValue>()(
  'SharedConfig'
) {
  static layer(input: SharedConfigInput) {
    return Layer.effect(SharedConfig)(decodeShared(input));
  }
}

export class AppConfig extends Context.Service<AppConfig, AppConfigValue>()('AppConfig') {
  static layer(input: AppConfigInput) {
    return Layer.effect(AppConfig)(decodeApp(input));
  }
}

export class AppPublicConfig extends Context.Service<AppPublicConfig, AppPublicConfigValue>()(
  'AppPublicConfig'
) {
  static layer(input: AppPublicConfigInput) {
    return Layer.effect(AppPublicConfig)(decodePublic(input));
  }
}

/** Derive SharedConfig from AppConfig so Database/Redis can depend on SharedConfig only. */
export const makeSharedConfigFromAppConfig = Layer.effect(SharedConfig)(
  Effect.gen(function* () {
    const app = yield* AppConfig;
    return {
      dbUrl: app.dbUrl,
      upstashRedisUrl: app.upstashRedisUrl,
      upstashRedisToken: app.upstashRedisToken,
      betterAuthUrl: app.betterAuthUrl,
      isDev: app.isDev,
      isProd: app.isProd
    } satisfies SharedConfigValue;
  })
);
