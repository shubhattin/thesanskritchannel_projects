import { describe, expect, it } from 'vitest';
import { Effect, Exit } from 'effect';
import {
  resolveDbUrl,
  type AppConfigInput,
  type AppPublicConfigInput,
  type SharedConfigInput
} from '../config';
import { createRunners } from '../run';
import { makeAppRuntime } from '../runtime_app';
import { ImageProcessor } from '../image';

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

describe('makeAppRuntime', () => {
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

  it('fails at first use when app config is invalid', async () => {
    const runtime = makeAppRuntime({ ...sampleApp(), openaiApiKey: '' }, samplePublic());
    const exit = await runtime.runPromiseExit(Effect.void);
    expect(Exit.isFailure(exit)).toBe(true);
    await runtime.dispose();
  });

  it('selects the sharp image live outside workerd', async () => {
    const runtime = makeAppRuntime(sampleApp(), samplePublic());
    const result = await runtime.runPromise(
      Effect.gen(function* () {
        const images = yield* ImageProcessor;
        return yield* images.compressToWebp(
          Buffer.from(
            'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
            'base64'
          )
        );
      })
    );
    expect(result.buffer.subarray(0, 4).toString()).toBe('RIFF');
    expect(result.width).toBe(1);
    await runtime.dispose();
  });
});
