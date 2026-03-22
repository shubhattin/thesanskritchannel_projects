import { redis } from '~/db/redis';
import type { RequestHandler } from './$types';
import { z } from 'zod';
import { db } from '~/db/db';
import { error } from '@sveltejs/kit';
import { texts } from '~/db/schema';
import { and, eq } from 'drizzle-orm';
import { REDIS_CACHE_KEYS_CLIENT } from '~/db/redis_shared';
import { shloka_list_schema } from '~/state/data_types';
import { remove_vedic_svara_chihnAni } from '~/utils/normalize_text';

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
          path_params_list: z.array(
            z.object({
              path_params: z.array(z.number()),
              new_shloka_list: shloka_list_schema
            })
          )
        })
      )
    })
    .parse(await request.json());

  // single transaction for all invalidations
  await db.transaction(async (tx) => {
    // project by project invalidation
    for (const data of keys) {
      const { project_id, path_params_list } = data;
      await Promise.all(
        path_params_list.map(async ({ path_params, new_shloka_list }) => {
          const path = path_params.join(':');

          // safest sync: replace rows for this (project_id, path)
          await tx.delete(texts).where(and(eq(texts.project_id, project_id), eq(texts.path, path)));

          if (new_shloka_list.length > 0) {
            await tx.insert(texts).values(
              new_shloka_list.map((s) => ({
                project_id,
                path,
                index: s.index,
                shloka_num: s.shloka_num,
                text: s.text,
                text_search: remove_vedic_svara_chihnAni(s.text)
              }))
            );
          }
        })
      );
      await redis.del(
        ...path_params_list.map(({ path_params }) =>
          REDIS_CACHE_KEYS_CLIENT.text_data(project_id, path_params)
        )
      );
    }
  });

  return new Response(JSON.stringify({ success: true }), {
    status: 200
  });
};
