import { TRPCError } from '@trpc/server';
import { and, eq, inArray, ne, sql } from 'drizzle-orm';
import { z } from 'zod';
import { protectedAppScopeProcedure_ProjectsPortal, publicProcedure, t } from '~/api/trpc_init';
import { db } from '~/db/db';
import { project_paths, translations } from '~/db/schema';
import { delay } from '~/tools/delay';
import { redis, REDIS_CACHE_KEYS } from '~/db/redis';
import { cache_db_options_app } from '~/server/cache_db_options';
import { get_project_by_key, get_project_info_by_id } from '~/server/project_list.server';
import { get_languages_for_project_user } from './project/project';
import { get_path_params } from '~/state/project_list';
import { get_translation_data_func } from '~/server/cached_loader';
import { requireProjectPath } from '~/server/project_paths_db.server';
import { TEXT_EDIT_LOCK_NAMESPACE } from '~/server/text_row_edit.server';

const edit_translation_input = z
  .object({
    project_id: z.int(),
    lang_id: z.int(),
    data: z.string().nullable().array(),
    indexes: z.number().array(),
    selected_text_levels: z.array(z.int().nullable())
  })
  .refine(({ data, indexes }) => data.length === indexes.length, {
    message: 'data and indexes must have the same length'
  });

const get_translation_route = publicProcedure
  .input(
    z.object({
      project_id: z.int(),
      lang_id: z.int(),
      selected_text_levels: z.array(z.int().nullable())
    })
  )
  .query(async ({ input: { project_id, lang_id, selected_text_levels } }) => {
    return get_translation_data_func(
      project_id,
      lang_id,
      selected_text_levels,
      cache_db_options_app
    );
  });

const edit_translation_route = protectedAppScopeProcedure_ProjectsPortal
  .input(edit_translation_input)
  .mutation(
    async ({
      ctx: { user },
      input: { project_id, lang_id, selected_text_levels, data, indexes }
    }) => {
      const { levels } = await get_project_info_by_id(project_id, cache_db_options_app);
      const path_params = get_path_params(selected_text_levels, levels);
      const path = path_params.join(':');
      const projectPath = await requireProjectPath(db, project_id, path);

      // authorization check to edit or add lang records
      if (user.role !== 'admin') {
        const languages = await get_languages_for_project_user(user.id, project_id, db);
        const allowed_langs = languages.map((lang) => lang.lang_id);
        if (!allowed_langs || !allowed_langs.includes(lang_id)) return { success: false };
      }

      const indexed_indexes = indexes.map((v, i) => [v, i] as const);
      await db.transaction(async (tx) => {
        await tx.execute(
          sql`select pg_advisory_xact_lock(${TEXT_EDIT_LOCK_NAMESPACE}, ${project_id})`
        );

        const existing_indexes = new Set(
          (
            await tx
              .select({ index: translations.index })
              .from(translations)
              .where(
                and(
                  eq(translations.project_path_id, projectPath.id),
                  eq(translations.lang_id, lang_id),
                  inArray(translations.index, indexes)
                )
              )
          ).map((v) => v.index)
        );

        const delete_entries = indexed_indexes.filter(([, i]) => data[i] === null);
        const add_entries = indexed_indexes.filter(
          ([index, i]) => data[i] !== null && !existing_indexes.has(index)
        );
        const update_entries = indexed_indexes.filter(
          ([index, i]) => data[i] !== null && existing_indexes.has(index)
        );

        await Promise.all([
          ...delete_entries.map(([index]) =>
            tx
              .delete(translations)
              .where(
                and(
                  eq(translations.project_path_id, projectPath.id),
                  eq(translations.lang_id, lang_id),
                  eq(translations.index, index)
                )
              )
          ),
          // add entries
          add_entries.length > 0 &&
            tx.insert(translations).values(
              add_entries.map(([index, i]) => ({
                project_path_id: projectPath.id,
                lang_id,
                index,
                text: data[i] ?? ''
              }))
            ),
          // update entries
          ...update_entries.map(([index, dataIndex]) =>
            tx
              .update(translations)
              .set({ text: data[dataIndex] ?? '' })
              .where(
                and(
                  eq(translations.project_path_id, projectPath.id),
                  eq(translations.lang_id, lang_id),
                  eq(translations.index, index)
                )
              )
          )
        ]);
      });

      await redis.del(REDIS_CACHE_KEYS.translation(project_id, lang_id, path_params));

      return {
        success: true
      };
    }
  );

const get_langs_with_translations_route = protectedAppScopeProcedure_ProjectsPortal
  .input(
    z.object({
      project_key: z.string(),
      path_params: z.int().array()
    })
  )
  .query(async ({ input: { project_key, path_params } }) => {
    const project = await get_project_by_key(project_key, cache_db_options_app);
    if (!project) {
      throw new TRPCError({ code: 'NOT_FOUND', message: `Project not found: ${project_key}` });
    }

    const path = path_params.join(':');
    const projectPath = await requireProjectPath(db, project.id, path);
    const rows = await db
      .select({ lang_id: translations.lang_id })
      .from(translations)
      .where(and(eq(translations.project_path_id, projectPath.id), ne(translations.text, '')))
      .groupBy(translations.lang_id);

    return rows.map((row) => row.lang_id);
  });

const get_all_langs_translation_route = protectedAppScopeProcedure_ProjectsPortal
  .input(
    z.object({
      project_id: z.int(),
      selected_text_levels: z.int().nullable().array()
    })
  )
  .query(async ({ input: { project_id, selected_text_levels } }) => {
    await delay(400);

    const { levels } = await get_project_info_by_id(project_id, cache_db_options_app);
    const path_params = get_path_params(selected_text_levels, levels);
    const path = path_params.join(':');
    const projectPath = await requireProjectPath(db, project_id, path);
    const data = await db
      .select({
        index: translations.index,
        text: translations.text,
        lang_id: translations.lang_id
      })
      .from(translations)
      .where(eq(translations.project_path_id, projectPath.id))
      .orderBy(translations.lang_id, translations.index);
    const data_map = new Map<number, Map<number, string>>();
    for (let i = 0; i < data.length; i++) {
      if (!data_map.has(data[i].lang_id)) data_map.set(data[i].lang_id, new Map());
      data_map.get(data[i].lang_id)!.set(data[i].index, data[i].text);
    }
    return data_map;
  });

export const translation_router = t.router({
  get_translation: get_translation_route,
  edit_translation: edit_translation_route,
  get_langs_with_translations: get_langs_with_translations_route,
  get_all_langs_translation: get_all_langs_translation_route
});
