import { Effect } from 'effect';
import type { RequestHandler } from './$types';
import { z } from 'zod';
import { texts } from '~/db/schema';
import { eq } from 'drizzle-orm';
import { REDIS_CACHE_KEYS_CLIENT } from '~/db/redis_shared';
import { shloka_list_schema } from '~/state/data_types';
import { remove_vedic_svara_chihnAni } from '~/utils/normalize_text';
import { requireProjectPath } from '~/utils/project/paths_db.server';
import { runRouteEffect } from '~/effect/app_runtime.server';
import { dbRun, dbTransaction } from '~/effect/database';
import { RedisClient } from '~/effect/redis';
import { UnauthorizedError } from '~/effect/errors';

const CACHE_KEY_DB_NAME = 'cache_verify_key';

export const POST: RequestHandler = async ({ request }) =>
  runRouteEffect(
    Effect.gen(function* () {
      const key = z.uuid().parse(request.headers.get('X-Cache-Verify-Key'));
      const KEY = yield* dbRun('invalidate_cache.verify_key', (db) =>
        db.query.other.findFirst({
          where: (tbl, { eq: eqOp }) => eqOp(tbl.key, CACHE_KEY_DB_NAME)
        })
      );
      if (!KEY || key !== KEY.value) {
        return yield* Effect.fail(UnauthorizedError.make({ message: 'UNAUTHORIZED' }));
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
        .parse(yield* Effect.promise(() => request.json()));

      const redis = yield* RedisClient;
      const redisKeys: string[] = [];

      // single transaction for all invalidations; redis after commit
      yield* dbTransaction('invalidate_cache.sync', async (tx) => {
        for (const data of keys) {
          const { project_id, path_params_list } = data;
          await Promise.all(
            path_params_list.map(async ({ path_params, new_shloka_list }) => {
              const path = path_params.join(':');
              const projectPath = await requireProjectPath(tx, project_id, path);

              // safest sync: replace rows for this resolved project path row
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
          for (const { path_params } of path_params_list) {
            redisKeys.push(REDIS_CACHE_KEYS_CLIENT.text_data(project_id, path_params));
          }
        }
      });

      if (redisKeys.length > 0) {
        yield* redis.del(...redisKeys);
      }

      return { success: true as const };
    })
  );
