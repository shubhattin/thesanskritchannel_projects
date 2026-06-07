import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { protectedAdminProcedure, publicProcedure, t } from '~/api/trpc_init';
import { db } from '~/db/db';
import { project_paths, projects, texts, translations } from '~/db/schema';
import { delay } from '~/tools/delay';
import { cache_db_options_app } from '~/server/cache_db_options';
import {
  clear_server_project_info_cache,
  clear_server_project_map_cache,
  get_project_by_key,
  get_project_info_by_id
} from '~/server/project_list.server';
import { notify_site_invalidate_project_map_cache } from '~/server/invalidate_site_project_cache.server';
import { remove_vedic_svara_chihnAni } from '../../utils/normalize_text';
import { and, eq, like, or, sql } from 'drizzle-orm';
import { get_path_params } from '~/state/project_list';
import { requireProjectPath } from '~/server/project_paths_db.server';
import {
  buildTextEditRedisKeys,
  buildTextRowsForSave,
  cloneMapWithUpdatedLeafCounts,
  getAffectedTranslationLangIds,
  remapTranslationsForTextRows,
  TEXT_EDIT_LOCK_NAMESPACE
} from '~/server/text_row_edit.server';
import { get_text_data_effect, redis_del_effect, runAppEffect } from '~/server/effect';

const get_text_data_route = publicProcedure
  .input(
    z.object({
      project_key: z.string(),
      path_params: z.int().array()
    })
  )
  .query(async ({ input: { project_key, path_params } }) => {
    await delay(350);
    const data = await runAppEffect(get_text_data_effect(project_key, path_params));
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

const save_text_rows_route = protectedAdminProcedure
  .input(
    z.object({
      project_id: z.int(),
      selected_text_levels: z.array(z.int().nullable()),
      rows: z
        .object({
          source_index: z.int().min(0).nullable(),
          text: z.string(),
          shloka_type: z.boolean()
        })
        .array()
    })
  )
  .mutation(async ({ input: { project_id, selected_text_levels, rows }, ctx: { cookie } }) => {
    const { levels } = await get_project_info_by_id(project_id, cache_db_options_app);
    const path_params = get_path_params(selected_text_levels, levels);
    if (levels > 1 && path_params.length === 0) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invalid text path selection' });
    }
    const path = path_params.join(':');
    const textRows = buildTextRowsForSave(rows);
    const shloka_count = textRows.filter((row) => row.shloka_num !== null).length;

    const { redisKeys, mapChanged, projectKey } = await db.transaction(async (tx) => {
      await tx.execute(
        sql`select pg_advisory_xact_lock(${TEXT_EDIT_LOCK_NAMESPACE}, ${project_id})`
      );

      const [project, projectPath] = await Promise.all([
        tx.query.projects.findFirst({
          where: (tbl, { eq: eqId }) => eqId(tbl.id, project_id),
          columns: { id: true, key: true, map: true }
        }),
        requireProjectPath(tx, project_id, path)
      ]);
      if (!project) throw new Error(`Project not found: ${project_id}`);

      const updatedMap = cloneMapWithUpdatedLeafCounts(project.map, path_params, {
        total: rows.length,
        shloka_count
      });
      const mapChanged = JSON.stringify(updatedMap) !== JSON.stringify(project.map);

      const existingTranslations = await tx
        .select({
          lang_id: translations.lang_id,
          index: translations.index,
          text: translations.text
        })
        .from(translations)
        .where(eq(translations.project_path_id, projectPath.id));
      const remappedTranslations = remapTranslationsForTextRows(rows, existingTranslations);

      // delete lll and then insert
      await tx.delete(translations).where(eq(translations.project_path_id, projectPath.id));
      await tx.delete(texts).where(eq(texts.project_path_id, projectPath.id));

      if (textRows.length > 0) {
        await tx.insert(texts).values(
          textRows.map((row) => ({
            project_path_id: projectPath.id,
            ...row
          }))
        );
      }
      if (remappedTranslations.length > 0) {
        await tx.insert(translations).values(
          remappedTranslations.map((row) => ({
            project_path_id: projectPath.id,
            ...row
          }))
        );
      }

      await tx.update(projects).set({ map: updatedMap }).where(eq(projects.id, project_id));

      return {
        mapChanged,
        projectKey: project.key,
        redisKeys: buildTextEditRedisKeys(
          project_id,
          path_params,
          getAffectedTranslationLangIds(existingTranslations)
        )
      };
    });

    if (redisKeys.length > 0) {
      await runAppEffect(redis_del_effect(...redisKeys));
    }
    if (mapChanged) {
      clear_server_project_map_cache(project_id);
      clear_server_project_info_cache(projectKey);
      await notify_site_invalidate_project_map_cache(cookie, project_id);
    }

    return { success: true as const };
  });

export const text_router = t.router({
  get_text_data: get_text_data_route,
  search_text_in_texts: search_text_in_texts_route,
  save_text_rows: save_text_rows_route
});
