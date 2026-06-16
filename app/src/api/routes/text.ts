import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { waitUntil } from '@vercel/functions';
import { protectedAdminProcedure, publicProcedure, t } from '~/api/trpc_init';
import { db } from '~/db/db';
import { project_paths, projects, texts, translations } from '~/db/schema';
import { delay_dev } from '~/tools/delay';
import { cache_db_options_app } from '~/utils/cache.server/cache_db_options.server';
import { CACHE, invalidate_and_refresh_cached } from '~/utils/cache.server/cached_loader.server';
import {
  clear_server_project_info_cache,
  clear_server_project_map_cache,
  get_project_by_key,
  get_project_info_by_id
} from '~/utils/project/list.server';
import { notify_site_invalidate_project_map_cache } from '~/utils/cache.server/invalidate_site_project_cache.server';
import { remove_vedic_svara_chihnAni } from '../../utils/normalize_text';
import { and, eq, inArray, like, or, sql } from 'drizzle-orm';
import { get_path_params } from '~/state/project_list';
import { requireProjectPath } from '~/utils/project/paths_db.server';
import {
  buildTextRowsForSave,
  cloneMapWithUpdatedLeafCounts,
  getAffectedTranslationLangIds,
  remapTranslationsForTextRows,
  TEXT_EDIT_LOCK_NAMESPACE
} from '~/utils/text/row_edit.server';

const get_text_data_route = publicProcedure
  .input(
    z.object({
      project_key: z.string(),
      path_params: z.int().array()
    })
  )
  .query(async ({ input: { project_key, path_params } }) => {
    await delay_dev(350);
    const data = await CACHE.text_data.get({ key: project_key, path_params }, cache_db_options_app);
    return data;
  });

const DEFAULT_PAGE_LIMIT = 20;
export const search_text_in_texts_route = publicProcedure
  .input(
    z.object({
      project_keys: z.string().array().min(1),
      path_prefixes: z
        .array(z.int().array())
        .optional()
        .transform((prefixes) => {
          if (!prefixes?.length) return undefined;
          const filtered = prefixes.filter((pp) => pp.length > 0);
          return filtered.length > 0 ? filtered : undefined;
        }),
      search_text: z.string().min(1).max(500),
      limit: z.int().min(1).max(100).default(DEFAULT_PAGE_LIMIT),
      offset: z.int().min(0).default(0)
    })
  )
  .query(async ({ input: { project_keys, search_text, path_prefixes, limit, offset } }) => {
    const conditions = [like(texts.text_search, `%${search_text}%`)];

    const project_ids: number[] = [];
    for (const key of project_keys) {
      const project = await get_project_by_key(key, cache_db_options_app);
      if (!project) throw new Error(`Project not found: ${key}`);
      project_ids.push(project.id);
    }
    conditions.push(inArray(project_paths.project_id, project_ids));

    if (path_prefixes && path_prefixes.length > 0) {
      const pathConditions = path_prefixes
        .filter((pp) => pp.length > 0)
        .map((pp) => {
          const prefix = pp.join(':');
          return or(eq(project_paths.path, prefix), like(project_paths.path, `${prefix}:%`));
        });
      if (pathConditions.length > 0) {
        conditions.push(or(...pathConditions)!);
      }
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

    const { affectedLangIds, mapChanged, projectKey } = await db.transaction(async (tx) => {
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
        affectedLangIds: getAffectedTranslationLangIds(existingTranslations)
      };
    });

    await Promise.all([
      invalidate_and_refresh_cached(
        CACHE.text_data,
        { key: projectKey, path_params: [...path_params] },
        cache_db_options_app
      ),
      // the delete might have affected the available translation langs
      invalidate_and_refresh_cached(
        CACHE.available_translation_langs,
        { project_id, path_params },
        cache_db_options_app
      )
    ]);
    for (const lang_id of affectedLangIds) {
      waitUntil(
        invalidate_and_refresh_cached(
          CACHE.translation,
          { project_id, lang_id, selected_text_levels },
          cache_db_options_app
        )
      );
    }
    if (mapChanged) {
      await invalidate_and_refresh_cached(CACHE.project_map, { project_id }, cache_db_options_app);
      clear_server_project_map_cache(project_id);
      clear_server_project_info_cache(projectKey);
      waitUntil(notify_site_invalidate_project_map_cache(cookie, project_id));
    }

    return { success: true as const };
  });

export const text_router = t.router({
  get_text_data: get_text_data_route,
  search_text_in_texts: search_text_in_texts_route,
  save_text_rows: save_text_rows_route
});
