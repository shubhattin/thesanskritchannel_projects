import { protectedAdminProcedure, t } from '../trpc_init';
import { redis } from '~/db/redis';
import { z } from 'zod';

const invalidate_cache_route = protectedAdminProcedure
  .input(
    z.object({
      cache_keys: z.array(z.string())
    })
  )
  .mutation(async ({ input: { cache_keys } }) => {
    const code = await redis.del(...cache_keys);
    return { success: true, code };
  });

export const cache_router = t.router({
  invalidate_cache: invalidate_cache_route
});
