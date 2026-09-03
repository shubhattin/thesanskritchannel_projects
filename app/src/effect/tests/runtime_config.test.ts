import { describe, expect, it } from 'vitest';
import { Effect, Exit } from 'effect';
import {
  resolveDbUrl,
  type AppConfigInput,
  type AppPublicConfigInput,
  type SharedConfigInput
} from '../config';
import { createRunners } from '../run';
import { makeAppRuntime, makeSiteRuntime } from '../runtime';

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

describe('resolveDbUrl (runtime fixtures)', () => {
  it('selects url from DB_MODE', () => {
    expect(
      resolveDbUrl({
        DB_MODE: 'PROD',
        PG_DATABASE_URL: 'postgresql://local/db',
        PG_DATABASE_URL1: 'postgresql://prod/db'
      })
    ).toBe('postgresql://prod/db');
  });
});

describe('makeAppRuntime / makeSiteRuntime', () => {
  it('builds an app runtime and runners from fixtures', async () => {
    const runtime = makeAppRuntime(sampleApp(), samplePublic());
    const runners = createRunners(runtime);
    expect(runtime.runPromise).toBeTypeOf('function');
    expect(runners.runTrpcEffect).toBeTypeOf('function');
    expect(runners.runServerEffect).toBeTypeOf('function');
    expect(runners.runRouteEffect).toBeTypeOf('function');
    expect(runners.runQstashEffect).toBeTypeOf('function');
    await runtime.dispose();
  });

  it('builds a site runtime and runners from fixtures', async () => {
    const runtime = makeSiteRuntime(sampleShared());
    const runners = createRunners(runtime);
    expect(runtime.runPromise).toBeTypeOf('function');
    expect(runners.runServerEffect).toBeTypeOf('function');
    expect(runners.runRouteEffect).toBeTypeOf('function');
    await runtime.dispose();
  });

  it('fails at first use when app config is invalid', async () => {
    const runtime = makeAppRuntime({ ...sampleApp(), openaiApiKey: '' }, samplePublic());
    const exit = await runtime.runPromiseExit(Effect.void);
    expect(Exit.isFailure(exit)).toBe(true);
    await runtime.dispose();
  });

  it('fails at first use when site config is invalid', async () => {
    const runtime = makeSiteRuntime({ ...sampleShared(), dbUrl: '' });
    const exit = await runtime.runPromiseExit(Effect.void);
    expect(Exit.isFailure(exit)).toBe(true);
    await runtime.dispose();
  });
});
