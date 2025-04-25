import { REDIS_CACHE_KEYS } from '~/db/redis';
import { protectedAdminProcedure, t } from '../trpc_init';
import { redis } from '~/db/redis';
import { z } from 'zod';

const invalidate_text_data_cache_route = protectedAdminProcedure
  .input(
    z.object({
      project_id: z.number().int(),
      path_params_list: z.array(z.number().int().nullable().array())
    })
  )
  .mutation(async ({ input: { project_id, path_params_list } }) => {
    const path_params_keys = path_params_list.map((path_params) =>
      REDIS_CACHE_KEYS.text_data(project_id, path_params)
    );
    await redis.del(...path_params_keys);
    return { success: true };
  });

export const cache_router = t.router({
  invalidate_text_data_cache: invalidate_text_data_cache_route
});
