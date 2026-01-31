import { redis } from '~/db/redis';
import type { RequestHandler } from './$types';
import { z } from 'zod';
import { db } from '~/db/db';
import { error } from '@sveltejs/kit';
import { texts } from '~/db/schema';
import { and, eq, inArray } from 'drizzle-orm';
import { REDIS_CACHE_KEYS_CLIENT } from '~/db/redis_shared';

const CACHE_KEY_DB_NAME = 'cache_verify_key';

export const POST: RequestHandler = async ({ url, request }) => {
  const key = z.string().uuid().parse(request.headers.get('X-Cache-Verify-Key'));
  const KEY = await db.query.other.findFirst({
    where: (tbl, { eq }) => eq(tbl.key, CACHE_KEY_DB_NAME)
  });
  if (!KEY || key !== KEY.value) {
    throw error(401, 'UNAUTHORIZED');
  }

  const { keys } = z
    .object({
      keys: z.array(
        z.object({
          project_id: z.number(),
          path_params_list: z.array(z.number().array())
        })
      )
    })
    .parse(await request.json());

  // project by project invalidation
  for (const data of keys) {
    const { project_id, path_params_list } = data;
    db.transaction(async (tx) => {
      await tx.delete(texts).where(
        and(
          eq(texts.project_id, project_id),
          inArray(
            texts.path,
            path_params_list.map((path_params) => path_params.join(':'))
          )
        )
      );
      await redis.del(
        ...path_params_list.map((path_params) =>
          REDIS_CACHE_KEYS_CLIENT.text_data(project_id, path_params)
        )
      );
    });
  }

  return new Response(JSON.stringify({ success: true }), {
    status: 200
  });
};
