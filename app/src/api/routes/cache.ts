import { Effect } from 'effect';
import { z } from 'zod';
import { protectedAdminProcedure, t } from '../trpc_init';
import { RedisClient } from '~/effect/redis';
import { runTrpcEffect } from '~/effect/app_runtime.server';

const invalidate_cache_route = protectedAdminProcedure
  .input(
    z.object({
      cache_keys: z.array(z.string())
    })
  )
  .mutation(({ input: { cache_keys } }) =>
    runTrpcEffect(
      Effect.gen(function* () {
        const redis = yield* RedisClient;
        const code = yield* redis.del(...cache_keys);
        return { success: true as const, code };
      })
    )
  );

const list_cache_keys_route = protectedAdminProcedure
  .input(
    z.object({
      pattern: z.string()
    })
  )
  .query(({ input: { pattern } }) =>
    runTrpcEffect(
      Effect.gen(function* () {
        const redis = yield* RedisClient;
        return yield* redis.getKeysWithPattern(pattern);
      })
    )
  );

export const cache_router = t.router({
  invalidate_cache: invalidate_cache_route,
  list_cache_keys: list_cache_keys_route
});
