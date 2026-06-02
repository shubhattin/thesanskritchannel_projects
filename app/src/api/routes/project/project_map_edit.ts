import { TRPCError } from '@trpc/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { protectedAdminProcedure, t } from '~/api/trpc_init';
import { db, type transactionType } from '~/db/db';
import { projects } from '~/db/schema';
import { redis } from '~/db/redis';
import { REDIS_CACHE_KEYS_CLIENT } from '~/db/redis_shared';
import {
  clear_server_project_info_cache,
  clear_server_project_map_cache
} from '~/server/project_list.server';
import { delay } from '~/tools/delay';
import { recursive_list_schema } from '~/state/data_types';

const project_id_input = z.object({
  project_id: z.int()
});

/** Ensures `project_id` exists; throws NOT_FOUND otherwise. */
const require_project = async (tx: transactionType, project_id: number) => {
  const project = await tx.query.projects.findFirst({
    where: (tbl, { eq: eqId }) => eqId(tbl.id, project_id),
    columns: { id: true, key: true }
  });
  if (!project) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Project not found' });
  }
  return project;
};

const invalidate_project_map_caches = async (project_id: number, project_key: string) => {
  clear_server_project_map_cache(project_id);
  clear_server_project_info_cache(project_key);
  if (import.meta.env.PROD) {
    await redis.del(REDIS_CACHE_KEYS_CLIENT.project_map(project_id));
  }
};

export const update_project_map_route = protectedAdminProcedure
  .input(
    project_id_input.extend({
      map: recursive_list_schema
    })
  )
  .mutation(async ({ input }) => {
    await delay(400);
    const project = await db.transaction(async (tx) => {
      const existing = await require_project(tx, input.project_id);
      const map = input.map;

      await tx
        .update(projects)
        .set({
          map,
          name_dev: map.name_dev
        })
        .where(eq(projects.id, input.project_id));

      return existing;
    });

    await invalidate_project_map_caches(input.project_id, project.key);
    return { success: true as const };
  });

export const project_map_edit_router = t.router({
  update: update_project_map_route
});
