import { and, eq, exists, inArray } from 'drizzle-orm';
import { z } from 'zod';
import {
  protectedAdminProcedure,
  protectedAppScopeProcedure_ProjectsPortal,
  publicProcedure,
  t
} from '~/api/trpc_init';
import { db } from '~/db/db';
import { translations } from '~/db/schema';
import { delay } from '~/tools/delay';
import { env } from '$env/dynamic/private';
import { redis, REDIS_CACHE_KEYS } from '~/db/redis';
import { cache_db_options_app } from '~/server/cache_db_options';
import { get_project_info_by_id } from '~/server/project_list.server';
import { fetch_post } from '~/tools/fetch';
import { get_languages_for_project_user } from './project';
import { get_path_params } from '~/state/project_list';
import { get_translation_data_func } from '~/server/cached_loader';

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
  .input(
    z.object({
      project_id: z.int(),
      lang_id: z.int(),
      data: z.string().array(),
      indexes: z.number().array(),
      selected_text_levels: z.array(z.int().nullable())
    })
  )
  .mutation(
    async ({
      ctx: { user },
      input: { project_id, lang_id, selected_text_levels, data, indexes }
    }) => {
      const { levels } = await get_project_info_by_id(project_id, cache_db_options_app);
      const path_params = get_path_params(selected_text_levels, levels);
      const path = path_params.join(':');

      // authorization check to edit or add lang records
      if (user.role !== 'admin') {
        const languages = await get_languages_for_project_user(user.id, project_id, db);
        const allowed_langs = languages.map((lang) => lang.lang_id);
        if (!allowed_langs || !allowed_langs.includes(lang_id)) return { success: false };
      }

      const indexed_indexes = indexes.map((v, i) => [v, i]);
      await db.transaction(async (tx) => {
        const existing_indexes = new Set(
          (
            await tx
              .select({ index: translations.index })
              .from(translations)
              .where(
                and(
                  eq(translations.project_id, project_id),
                  eq(translations.lang_id, lang_id),
                  eq(translations.path, path),
                  inArray(translations.index, indexes)
                )
              )
          ).map((v) => v.index)
        );

        const add_entries = indexed_indexes.filter(([index]) => !existing_indexes.has(index));
        const update_entries = indexed_indexes.filter(([index]) => existing_indexes.has(index));

        await Promise.all([
          // add entries
          add_entries.length > 0 &&
            tx.insert(translations).values(
              add_entries.map(([index, i]) => ({
                project_id,
                lang_id,
                path,
                index,
                text: data[i]
              }))
            ),
          // update entries
          ...update_entries.map(([index, dataIndex]) =>
            tx
              .update(translations)
              .set({ text: data[dataIndex] })
              .where(
                and(
                  eq(translations.project_id, project_id),
                  eq(translations.lang_id, lang_id),
                  eq(translations.path, path),
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
    const data = await db.query.translations.findMany({
      columns: {
        index: true,
        text: true,
        lang_id: true
      },
      where: (tbl, { eq, and }) => and(eq(tbl.project_id, project_id), eq(tbl.path, path)),
      orderBy: ({ lang_id, index }, { asc }) => [asc(lang_id), asc(index)]
    });
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
  get_all_langs_translation: get_all_langs_translation_route
});
