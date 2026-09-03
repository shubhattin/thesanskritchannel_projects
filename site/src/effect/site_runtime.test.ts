import { describe, expect, it } from 'vitest';
import { Effect, Exit } from 'effect';
import { BackgroundWork } from '$app/effect/background';
import { createRunners } from '$app/effect/run';
import { makeSiteRuntime, type SiteRuntime } from './site_runtime';
import type { SharedConfigInput } from '$app/effect/config';

const sampleShared = (): SharedConfigInput => ({
  dbUrl: 'postgresql://local/db',
  upstashRedisUrl: 'https://example.upstash.io',
  upstashRedisToken: 'redis-token',
  betterAuthUrl: 'http://localhost:5173',
  isDev: true,
  isProd: false
});

describe('makeSiteRuntime', () => {
  it('builds a site runtime and runners from fixtures', async () => {
    const runtime: SiteRuntime = makeSiteRuntime(sampleShared(), BackgroundWork.Test);
    const runners = createRunners(runtime);
    expect(runtime.runPromise).toBeTypeOf('function');
    expect(runners.runServerEffect).toBeTypeOf('function');
    expect(runners.runRouteEffect).toBeTypeOf('function');
    await runtime.dispose();
  });

  it('fails at first use when site config is invalid', async () => {
    const runtime = makeSiteRuntime({ ...sampleShared(), dbUrl: '' }, BackgroundWork.Test);
    const exit = await runtime.runPromiseExit(Effect.void);
    expect(Exit.isFailure(exit)).toBe(true);
    await runtime.dispose();
  });
});
