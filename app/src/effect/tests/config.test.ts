import { describe, expect, it } from 'vitest';
import { Effect, Exit, Redacted } from 'effect';
import {
  AppConfig,
  AppPublicConfig,
  resolveDbUrl,
  SharedConfig,
  type AppConfigInput,
  type AppPublicConfigInput,
  type SharedConfigInput
} from '../config';

const env = (vars: Record<string, string | undefined>) => vars;

const sampleShared = (): SharedConfigInput => ({
  dbUrl: 'postgresql://local/db',
  upstashRedisUrl: 'https://example.upstash.io',
  upstashRedisToken: 'redis-token',
  betterAuthUrl: 'http://localhost:5173',
  isDev: true,
  isProd: false
});

const sampleApp = (): AppConfigInput => ({
  ...sampleShared(),
  awsRegion: 'us-west-2',
  awsAccessKeyId: 'AKIAEXAMPLE',
  awsSecretAccessKey: 'secret',
  awsS3BucketName: 'bucket',
  openaiApiKey: 'sk-test',
  openrouterApiKey: 'or-test',
  qstashToken: 'qstash-token',
  qstashCurrentSigningKey: 'sig_current',
  qstashNextSigningKey: 'sig_next',
  qstashBaseUrl: 'https://qstash.example.com',
  siteUrl: 'http://localhost:5173',
  mainSiteUrl: 'https://example.com',
  cloudfrontUrl: 'https://d123.cloudfront.net',
  isQstashEnabled: false
});

const samplePublic = (): AppPublicConfigInput => ({
  betterAuthUrl: 'http://localhost:5173',
  cloudfrontUrl: 'https://d123.cloudfront.net',
  siteUrl: 'http://localhost:5173',
  mainSiteUrl: 'https://example.com'
});

describe('resolveDbUrl', () => {
  it('uses PG_DATABASE_URL by default', () => {
    expect(
      resolveDbUrl(
        env({
          PG_DATABASE_URL: 'postgresql://local/db'
        })
      )
    ).toBe('postgresql://local/db');
  });

  it('prefers PROD url when DB_MODE=PROD', () => {
    expect(
      resolveDbUrl(
        env({
          DB_MODE: 'PROD',
          PG_DATABASE_URL: 'postgresql://local/db',
          PG_DATABASE_URL1: 'postgresql://prod/db'
        })
      )
    ).toBe('postgresql://prod/db');
  });

  it('does not fall back when PROD url is missing', () => {
    expect(
      resolveDbUrl(
        env({
          DB_MODE: 'PROD',
          PG_DATABASE_URL: 'postgresql://local/db'
        })
      )
    ).toBeUndefined();
  });

  it('prefers PREVIEW url when DB_MODE=PREVIEW', () => {
    expect(
      resolveDbUrl(
        env({
          DB_MODE: 'PREVIEW',
          PG_DATABASE_URL: 'postgresql://local/db',
          PG_DATABASE_URL2: 'postgresql://preview/db'
        })
      )
    ).toBe('postgresql://preview/db');
  });

  it('rejects unsupported DB_MODE values', () => {
    expect(
      resolveDbUrl(
        env({
          DB_MODE: 'STAGING',
          PG_DATABASE_URL: 'postgresql://local/db'
        })
      )
    ).toBeUndefined();
  });

  it('returns undefined when no url is set', () => {
    expect(resolveDbUrl(env({}))).toBeUndefined();
  });
});

describe('config layers', () => {
  it('builds SharedConfig from plain values', async () => {
    const exit = await Effect.runPromiseExit(
      Effect.gen(function* () {
        const config = yield* SharedConfig;
        expect(Redacted.value(config.dbUrl)).toBe('postgresql://local/db');
        expect(config.betterAuthUrl).toBe('http://localhost:5173');
        expect(config.isDev).toBe(true);
        return config.isProd;
      }).pipe(Effect.provide(SharedConfig.layer(sampleShared())))
    );
    expect(Exit.isSuccess(exit)).toBe(true);
    if (!Exit.isSuccess(exit)) throw new Error('expected a successful exit');
    expect(exit.value).toBe(false);
  });

  it('builds AppConfig with redacted secrets', async () => {
    const exit = await Effect.runPromiseExit(
      Effect.gen(function* () {
        const config = yield* AppConfig;
        expect(Redacted.value(config.openaiApiKey)).toBe('sk-test');
        expect(Redacted.value(config.qstashCurrentSigningKey)).toBe('sig_current');
        expect(Redacted.value(config.qstashNextSigningKey)).toBe('sig_next');
        expect(config.awsRegion).toBe('us-west-2');
        expect(config.isQstashEnabled).toBe(false);
        return true;
      }).pipe(Effect.provide(AppConfig.layer(sampleApp())))
    );
    expect(Exit.isSuccess(exit)).toBe(true);
  });

  it('rejects empty AppConfig secrets', async () => {
    const exit = await Effect.runPromiseExit(
      Effect.gen(function* () {
        return yield* AppConfig;
      }).pipe(
        Effect.provide(
          AppConfig.layer({
            ...sampleApp(),
            openaiApiKey: ''
          })
        )
      )
    );
    expect(Exit.isFailure(exit)).toBe(true);
  });

  it('builds AppPublicConfig', async () => {
    const exit = await Effect.runPromiseExit(
      Effect.gen(function* () {
        const config = yield* AppPublicConfig;
        expect(config.siteUrl).toBe('http://localhost:5173');
        expect(config.mainSiteUrl).toBe('https://example.com');
        return true;
      }).pipe(Effect.provide(AppPublicConfig.layer(samplePublic())))
    );
    expect(Exit.isSuccess(exit)).toBe(true);
  });
});
