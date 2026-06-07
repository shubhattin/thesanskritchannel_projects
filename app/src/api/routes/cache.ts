import { protectedAdminProcedure, t } from '../trpc_init';
import { getKeysWithPattern } from '~/db/redis';
import { z } from 'zod';
import { redis_del_effect, runAppEffect } from '~/server/effect';

const invalidate_cache_route = protectedAdminProcedure
  .input(
    z.object({
      cache_keys: z.array(z.string())
    })
  )
  .mutation(async ({ input: { cache_keys } }) => {
    const code = await runAppEffect(redis_del_effect(...cache_keys));
    return { success: true, code };
  });

const list_cache_keys_route = protectedAdminProcedure
  .input(
    z.object({
      pattern: z.string()
    })
  )
  .query(async ({ input: { pattern } }) => {
    const keys = await getKeysWithPattern(pattern);
    return keys;
  });

export const cache_router = t.router({
  invalidate_cache: invalidate_cache_route,
  list_cache_keys: list_cache_keys_route
});
