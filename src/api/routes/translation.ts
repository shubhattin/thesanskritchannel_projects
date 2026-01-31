import { and, eq, exists, inArray } from 'drizzle-orm';
import { z } from 'zod';
import {
  protectedAdminProcedure,
  protectedAppScopeProcedure,
  publicProcedure,
  t
} from '~/api/trpc_init';
import { db } from '~/db/db';
import { translations } from '~/db/schema';
import { delay } from '~/tools/delay';
import { env } from '$env/dynamic/private';
import { redis, REDIS_CACHE_KEYS } from '~/db/redis';
import { get_project_info_from_id } from '~/state/project_list';
import ms from 'ms';
import { fetch_post } from '~/tools/fetch';
import { get_languages_for_project_user } from './project';
import { get_path_params } from '~/state/project_list';
import { waitUntil } from '@vercel/functions';

const get_translation_route = publicProcedure
  .input(
    z.object({
      project_id: z.number().int(),
      lang_id: z.number().int(),
      selected_text_levels: z.array(z.number().int().nullable())
    })
  )
  .query(async ({ input: { project_id, lang_id, selected_text_levels } }) => {
    let data: {
      index: number;
      text: string;
    }[] = [];

    const path_params = get_path_params(
      selected_text_levels,
      get_project_info_from_id(project_id).levels
    );
    const path = path_params.join(':');
    let cache = null;
    if (import.meta.env.PROD) {
      cache = await redis.get<typeof data>(
        REDIS_CACHE_KEYS.translation(project_id, lang_id, path_params)
      );
    }
    if (cache) data = cache;
    else {
      data = await db.query.translations.findMany({
        columns: {
          index: true,
          text: true
        },
        where: (tbl, { eq, and }) =>
          and(eq(tbl.project_id, project_id), eq(tbl.lang_id, lang_id), eq(tbl.path, path))
      });
      if (import.meta.env.PROD) {
        // set cache in background
        waitUntil(
          redis.set(REDIS_CACHE_KEYS.translation(project_id, lang_id, path_params), data, {
            ex: ms('30days') / 1000
          })
        );
      }
    }
    const data_map = new Map<number, string>();
    for (let i = 0; i < data.length; i++) data_map.set(data[i].index, data[i].text);
    return data_map;
  });

const edit_translation_route = protectedAppScopeProcedure
  .input(
    z.object({
      project_id: z.number().int(),
      lang_id: z.number().int(),
      data: z.string().array(),
      indexes: z.number().array(),
      selected_text_levels: z.array(z.number().int().nullable())
    })
  )
  .mutation(
    async ({
      ctx: { user },
      input: { project_id, lang_id, selected_text_levels, data, indexes }
    }) => {
      const path_params = get_path_params(
        selected_text_levels,
        get_project_info_from_id(project_id).levels
      );
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

const get_all_langs_translation_route = protectedAppScopeProcedure
  .input(
    z.object({
      project_id: z.number().int(),
      selected_text_levels: z.number().int().nullable().array()
    })
  )
  .query(async ({ input: { project_id, selected_text_levels } }) => {
    await delay(400);

    const path_params = get_path_params(
      selected_text_levels,
      get_project_info_from_id(project_id).levels
    );
    const path = path_params.join(':');
    const data = await db.query.translations.findMany({
      columns: {
        index: true,
        text: true,
        lang_id: true
      },
      where: (tbl, { eq, and }) => and(eq(tbl.project_id, project_id), eq(tbl.path, path))
    });
    const data_map = new Map<number, Map<number, string>>();
    for (let i = 0; i < data.length; i++) {
      if (!data_map.has(data[i].lang_id)) data_map.set(data[i].lang_id, new Map());
      data_map.get(data[i].lang_id)!.set(data[i].index, data[i].text);
    }
    return data_map;
  });

const trigger_translation_commit_route = protectedAdminProcedure.mutation(async () => {
  const owner = 'shubhattin';
  const repo = 'thesanskritchannel_projects';
  const workflow_id = 'commit_trans.yml';
  const req = await fetch_post(
    `https://api.github.com/repos/${owner}/${repo}/actions/workflows/${workflow_id}/dispatches`,
    {
      headers: {
        Authorization: `Bearer ${env.GITHUB_API_KEY}`
      },
      json: {
        ref: 'main'
      }
    }
  );
  return req.ok;
});

export const translation_router = t.router({
  get_translation: get_translation_route,
  edit_translation: edit_translation_route,
  get_all_langs_translation: get_all_langs_translation_route,
  trigger_translation_commit: trigger_translation_commit_route
});
