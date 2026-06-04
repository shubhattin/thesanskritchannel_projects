import { z } from 'zod';
import { publicProcedure, t } from '~/api/trpc_init';
import { db } from '~/db/db';
import { project_paths, texts } from '~/db/schema';
import { delay } from '~/tools/delay';
import { cache_db_options_app } from '~/server/cache_db_options';
import { get_text_data_func } from '~/server/cached_loader';
import { get_project_by_key } from '~/server/project_list.server';
// import { remove_vedic_svara_chihnAni } from '../../utils/normalize_text';
import { and, eq, like, or, sql } from 'drizzle-orm';

const get_text_data_route = publicProcedure
  .input(
    z.object({
      project_key: z.string(),
      path_params: z.int().array()
    })
  )
  .query(async ({ input: { project_key, path_params } }) => {
    await delay(350);
    const data = await get_text_data_func(project_key, path_params, cache_db_options_app);
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
      const project = await get_project_by_key(project_key, cache_db_options_app);
      if (!project) throw new Error(`Project not found: ${project_key}`);
      const project_id = project.id;
      conditions.push(eq(project_paths.project_id, project_id));
    }
    if (typeof path_params !== 'undefined' && path_params.length > 0) {
      const prefix = path_params.join(':');
      conditions.push(or(eq(project_paths.path, prefix), like(project_paths.path, `${prefix}:%`))!);
    }

    const data = await db
      .select({
        project_id: project_paths.project_id,
        path: project_paths.path,
        index: texts.index,
        shloka_num: texts.shloka_num,
        text: texts.text,
        totalCount: sql<number>`count(*) over()`
      })
      .from(texts)
      .innerJoin(project_paths, eq(texts.project_path_id, project_paths.id))
      .where(and(...conditions))
      .orderBy(project_paths.project_id, project_paths.path, texts.index)
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
