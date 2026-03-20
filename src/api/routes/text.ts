import { z } from 'zod';
import { publicProcedure, t } from '~/api/trpc_init';
import { db } from '~/db/db';
import { texts } from '~/db/schema';
import { delay } from '~/tools/delay';
import { get_text_data_func } from '~/server/text_loader';
import { get_project_from_key, type project_keys_type } from '~/state/project_list';
import { waitUntil } from '@vercel/functions';
import { and, eq, like, sql } from 'drizzle-orm';
import { remove_vedic_svara_chihnAni } from '../../utils/normalize_text';
import { redis } from '~/db/redis';

const get_text_data_route = publicProcedure
  .input(
    z.object({
      project_key: z.string(),
      path_params: z.int().array()
    })
  )
  .query(async ({ input: { project_key, path_params } }) => {
    await delay(350);
    const data = await get_text_data_func(project_key, path_params, {
      defer: waitUntil,
      db: db,
      redis: redis
    });
    return data;
  });

const DEFAULT_PAGE_LIMIT = 20;
export const search_text_in_texts_route = publicProcedure
  .input(
    z.object({
      project_key: z.string().optional(),
      path_params: z.int().array().optional(),
      search_text: z.string().min(1).max(500),
      limit: z.int().min(1).max(100).default(DEFAULT_PAGE_LIMIT),
      offset: z.int().min(0).default(0)
    })
  )
  .query(async ({ input: { project_key, search_text, path_params, limit, offset } }) => {
    const conditions = [like(texts.text_search, `%${search_text}%`)];
    if (project_key) {
      const project_id = get_project_from_key(project_key as project_keys_type).id;
      conditions.push(eq(texts.project_id, project_id));
    }
    if (typeof path_params !== 'undefined') {
      conditions.push(like(texts.path, `${path_params.join(':')}%`));
    }

    const data = await db
      .select({
        project_id: texts.project_id,
        path: texts.path,
        index: texts.index,
        shloka_num: texts.shloka_num,
        text: texts.text,
        totalCount: sql<number>`count(*) over()`
      })
      .from(texts)
      .where(and(...conditions))
      .orderBy(texts.project_id, texts.path, texts.index)
      .limit(limit + 1)
      .offset(offset);

    const hasMore = data.length > limit;
    const items = hasMore ? data.slice(0, limit) : data;
    const totalCount = data.length ? Number(data[0].totalCount) : 0;

    return {
      items,
      page: {
        limit,
        offset,
        nextOffset: hasMore ? offset + limit : null,
        hasMore,
        totalCount
      }
    };
  });

export const text_router = t.router({
  get_text_data: get_text_data_route,
  search_text_in_texts: search_text_in_texts_route
});
