import type { RequestHandler } from './$types';
import { z } from 'zod';
import { error } from '@sveltejs/kit';
import { texts } from '~/db/schema';
import { eq } from 'drizzle-orm';
import { shloka_list_schema } from '~/state/data_types';
import { remove_vedic_svara_chihnAni } from '~/utils/normalize_text';
import { requireProjectPath } from '~/server/project/paths-db.server';
import {
  REDIS_CACHE_KEYS,
  redis_del_effect,
  runAppEffect,
  withDb,
  withTransaction
} from '~/server/effect';

const CACHE_KEY_DB_NAME = 'cache_verify_key';

export const POST: RequestHandler = async ({ request }) => {
  const key = z.uuid().parse(request.headers.get('X-Cache-Verify-Key'));
  const KEY = await runAppEffect(
    withDb('invalidate_cache.verify', (db) =>
      db.query.other.findFirst({
        where: (tbl, { eq: eqKey }) => eqKey(tbl.key, CACHE_KEY_DB_NAME)
      })
    )
  );
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

  const redisKeys: string[] = [];

  await runAppEffect(
    withTransaction('invalidate_cache.sync', async (tx) => {
      for (const data of keys) {
        const { project_id, path_params_list } = data;
        await Promise.all(
          path_params_list.map(async ({ path_params, new_shloka_list }) => {
            const path = path_params.join(':');
            const projectPath = await requireProjectPath(tx, project_id, path);

            await tx.delete(texts).where(eq(texts.project_path_id, projectPath.id));

            if (new_shloka_list.length > 0) {
              await tx.insert(texts).values(
                new_shloka_list.map((s) => ({
                  project_path_id: projectPath.id,
                  index: s.index,
                  shloka_num: s.shloka_num,
                  text: s.text,
                  text_search: remove_vedic_svara_chihnAni(s.text)
                }))
              );
            }
          })
        );
        redisKeys.push(
          ...path_params_list.map(({ path_params }) =>
            REDIS_CACHE_KEYS.text_data(project_id, path_params)
          )
        );
      }
    })
  );

  if (redisKeys.length > 0) {
    await runAppEffect(redis_del_effect(...redisKeys));
  }

  return new Response(JSON.stringify({ success: true }), {
    status: 200
  });
};
