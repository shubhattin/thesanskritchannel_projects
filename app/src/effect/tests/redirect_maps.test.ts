import { describe, expect, it } from 'vitest';
import { Effect, Layer, ManagedRuntime } from 'effect';
import { BackgroundWork } from '../background';
import { NO_CACHE_PARAMS } from '../cache';
import { SharedConfig } from '../config';
import { DatabaseHttp } from '../database';
import { RedisClient } from '../redis';
import {
  clearProjectRegistryCache,
  projectRedirectMapCache,
  resolveProjectByKey
} from '../project_registry';
import { resolveLekhaBySlug } from '../lekha_registry';

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

  type SeedPayload =
    | { key: string; target: string }[]
    | { live: string[]; redirects: { slug: string; target: string }[] };

  return {
    layer: Layer.succeed(RedisClient)({
      // SAFETY: the memory store only ever holds cache payloads written through this
      // test double's own `set`, so reading an entry back as `T | undefined` is sound.
      get: <T = unknown>(key: string) => Effect.succeed((store.get(key) as T | undefined) ?? null),
      set: (key, value, options) =>
        Effect.sync(() => {
          const nx = options && 'nx' in options && options.nx === true;
          if (nx && store.has(key)) return null;
          store.set(key, value);
          return 'OK';
        }),
      del: (...keys) =>
        Effect.sync(() => {
          let n = 0;
          for (const key of keys) {
            if (store.delete(key)) n += 1;
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
    }),
    seed: (key: string, value: SeedPayload) => {
      store.set(key, value);
    }
  };
};

/** DB stub: serves the project list; dies on any other query to prove zero-DB paths. */
const projectListDbLayer = (projects: unknown[]) =>
  Layer.succeed(DatabaseHttp)({
    // SAFETY: the stub only supports the project-list query shape used by
    // `projectListCache.fetch`; anything else is a loud test failure, not a cast lie.
    run: (_operation, run) =>
      Effect.promise(async () =>
        run({
          query: {
            projects: {
              findMany: async () => projects
            }
          }
          // SAFETY: `never` client keeps the generic `A` intact; the literal only
          // supports the project-list query shape used by `projectListCache.fetch`.
        } as never)
      )
  });

const dbDieLayer = Layer.succeed(DatabaseHttp)({
  run: (_operation, _run) =>
    Effect.die(new Error('DatabaseHttp.run should not be called in redirect-map unit test'))
});

const cannedProjects = [
  {
    id: 1,
    name: 'Ramayanam',
    name_dev: 'रामायणम्',
    description: null,
    key: 'ramayanam',
    uid: 'uid01',
    listed: true
  }
];

const makeRuntime = (dbLayer: Layer.Layer<DatabaseHttp>) => {
  const redis = makeMemoryRedis();
  const runtime = ManagedRuntime.make(
    Layer.mergeAll(sharedLayer, redis.layer, BackgroundWork.Test, dbLayer)
  );
  return { runtime, redis };
};

describe('projectRedirectMapCache', () => {
  it('transforms redirect rows to a key->canonical Map', async () => {
    const { runtime, redis } = makeRuntime(dbDieLayer);
    try {
      redis.seed('project_redirect_map', [{ key: 'old-key', target: 'ramayanam' }]);
      const map = await runtime.runPromise(projectRedirectMapCache.get(NO_CACHE_PARAMS));
      expect(map.get('old-key')).toBe('ramayanam');
      expect(map.has('ramayanam')).toBe(false);
    } finally {
      await runtime.dispose();
    }
  });
});

describe('resolveProjectByKey', () => {
  it('resolves live keys directly without touching redirects', async () => {
    clearProjectRegistryCache();
    const { runtime } = makeRuntime(projectListDbLayer(cannedProjects));
    try {
      const resolved = await runtime.runPromise(resolveProjectByKey('ramayanam'));
      expect(resolved?.project.key).toBe('ramayanam');
      expect(resolved?.was_redirect).toBe(false);
    } finally {
      await runtime.dispose();
    }
  });

  it('resolves old keys via the cached map with zero redirect-table queries', async () => {
    clearProjectRegistryCache();
    const { runtime, redis } = makeRuntime(projectListDbLayer(cannedProjects));
    try {
      redis.seed('project_redirect_map', [{ key: 'old-key', target: 'ramayanam' }]);
      const resolved = await runtime.runPromise(resolveProjectByKey('old-key'));
      expect(resolved?.project.key).toBe('ramayanam');
      expect(resolved?.requested_key).toBe('old-key');
      expect(resolved?.was_redirect).toBe(true);
    } finally {
      await runtime.dispose();
    }
  });

  it('returns undefined for unknown keys', async () => {
    clearProjectRegistryCache();
    const { runtime, redis } = makeRuntime(projectListDbLayer(cannedProjects));
    try {
      redis.seed('project_redirect_map', []);
      const resolved = await runtime.runPromise(resolveProjectByKey('missing'));
      expect(resolved).toBeUndefined();
    } finally {
      await runtime.dispose();
    }
  });
});

describe('resolveLekhaBySlug', () => {
  it('resolves old slugs via the cached map with zero DB queries', async () => {
    const { runtime, redis } = makeRuntime(dbDieLayer);
    try {
      redis.seed('site_lekha_slug_map', {
        live: ['current-slug'],
        redirects: [{ slug: 'old-slug', target: 'current-slug' }]
      });
      const resolved = await runtime.runPromise(resolveLekhaBySlug('old-slug'));
      expect(resolved).toEqual({
        url_slug: 'current-slug',
        requested_slug: 'old-slug',
        was_redirect: true
      });
    } finally {
      await runtime.dispose();
    }
  });

  it('live slugs win over redirect rules and unknown slugs resolve undefined', async () => {
    const { runtime, redis } = makeRuntime(dbDieLayer);
    try {
      redis.seed('site_lekha_slug_map', {
        live: ['current-slug'],
        redirects: [
          { slug: 'old-slug', target: 'current-slug' },
          // Live slug also present as a redirect source: live wins (no redirect).
          { slug: 'current-slug', target: 'current-slug' }
        ]
      });
      expect(await runtime.runPromise(resolveLekhaBySlug('current-slug'))).toBeUndefined();
      expect(await runtime.runPromise(resolveLekhaBySlug('missing'))).toBeUndefined();
    } finally {
      await runtime.dispose();
    }
  });
});
