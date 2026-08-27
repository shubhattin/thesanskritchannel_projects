import { describe, expect, it } from 'vitest';
import { Effect, Exit, Layer, ManagedRuntime } from 'effect';
import { z } from 'zod';
import { createCache } from '../cache';
import { BackgroundWork } from '../background';
import { SharedConfig } from '../config';
import { Database } from '../database';
import { RedisClient } from '../redis';
import { CacheError } from '../errors';

const sharedLayer = SharedConfig.layer({
  dbUrl: 'postgresql://local/db',
  upstashRedisUrl: 'https://example.upstash.io',
  upstashRedisToken: 'redis-token',
  betterAuthUrl: 'http://localhost:5173',
  isDev: false,
  isProd: true
});

const makeMemoryRedis = () => {
  const store = new Map<string, unknown>();
  const locks = new Map<string, string>();

  return Layer.succeed(RedisClient)({
    get: <T = unknown>(key: string) => Effect.succeed((store.get(key) as T | undefined) ?? null),
    set: (key, value, options) =>
      Effect.sync(() => {
        const nx = options && 'nx' in options && options.nx === true;
        if (nx && store.has(key)) return null;
        store.set(key, value);
        if (nx) locks.set(key, String(value));
        return 'OK';
      }),
    del: (...keys) =>
      Effect.sync(() => {
        let n = 0;
        for (const key of keys) {
          if (store.delete(key)) n += 1;
          locks.delete(key);
        }
        return n;
      }),
    incr: (key) =>
      Effect.sync(() => {
        const next = Number(store.get(key) ?? 0) + 1;
        store.set(key, next);
        return next;
      }),
    eval: () => Effect.succeed(1),
    deleteKeysWithPattern: () => Effect.succeed(0),
    getKeysWithPattern: () => Effect.succeed([])
  });
};

const databaseLayer = Layer.succeed(Database)({
  run: (_operation, _run) =>
    Effect.die(new Error('Database.run should not be called in cache unit test')),
  transaction: (_operation, _run) =>
    Effect.die(new Error('Database.transaction should not be called in cache unit test'))
});

describe('createCache', () => {
  it('serves cached values and refreshes after delete', async () => {
    let fetches = 0;
    const cache = createCache<undefined, { value: number }>({
      getKey: () => 'test:cache:item',
      schema: z.object({ value: z.number() }),
      fetch: Effect.fn('test.fetch')(
        // oxlint-disable-next-line require-yield -- Effect.fn generator that only returns, per Effect idiom
        function* () {
          fetches += 1;
          return { value: fetches };
        }
      ),
      cacheOutsideProd: true
    });

    const runtime = ManagedRuntime.make(
      Layer.mergeAll(sharedLayer, makeMemoryRedis(), BackgroundWork.Test, databaseLayer)
    );

    try {
      const first = await runtime.runPromise(cache.get(undefined));
      const second = await runtime.runPromise(cache.get(undefined));
      expect(first).toEqual({ value: 1 });
      expect(second).toEqual({ value: 1 });
      expect(fetches).toBe(1);

      await runtime.runPromise(cache.delete(undefined));
      const third = await runtime.runPromise(cache.get(undefined));
      expect(third).toEqual({ value: 2 });
      expect(fetches).toBe(2);
    } finally {
      await runtime.dispose();
    }
  });

  it('maps fetch failures to CacheError', async () => {
    const cache = createCache<undefined, { value: number }>({
      getKey: () => 'test:cache:fail',
      schema: z.object({ value: z.number() }),
      fetch: () => Effect.fail(CacheError.make({ operation: 'boom', cause: 'x' })),
      cacheOutsideProd: true
    });

    const runtime = ManagedRuntime.make(
      Layer.mergeAll(sharedLayer, makeMemoryRedis(), BackgroundWork.Test, databaseLayer)
    );

    try {
      const exit = await runtime.runPromiseExit(cache.get(undefined));
      expect(Exit.isFailure(exit)).toBe(true);
    } finally {
      await runtime.dispose();
    }
  });
});
