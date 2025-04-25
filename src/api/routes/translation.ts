import { and, eq, exists, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { protectedAdminProcedure, protectedProcedure, publicProcedure, t } from '~/api/trpc_init';
import { db } from '~/db/db';
import { translation } from '~/db/schema';
import type { shloka_list_type } from '~/state/data_types';
import { delay } from '~/tools/delay';
import { env } from '$env/dynamic/private';
import { Buffer } from 'buffer';
import { redis, REDIS_CACHE_KEYS } from '~/db/redis';
import {
  get_project_from_key,
  get_project_info_from_id,
  type project_keys_type
} from '~/state/project_list';
import ms from 'ms';
import { fetch_post } from '~/tools/fetch';
import { get_languages_for_ptoject_user } from './project';
import { get_path_params } from '~/state/project_list';

/** first and second here are like the ones in url */
export const get_text_data_func = async (key: string, path_params: number[]) => {
  // Add Caching to load in PROD
  const project_id = get_project_from_key(key as project_keys_type).id;
  const loc =
    `data/${project_id}. ${key}/data` +
    (path_params.length !== 0 ? `/${path_params.join('/')}.json` : `.json`);
  if (import.meta.env.DEV) {
    const fs = await import('fs');
    return JSON.parse(fs.readFileSync('./' + loc, 'utf8')) as shloka_list_type;
  }

  const cache = await redis.get<shloka_list_type>(
    REDIS_CACHE_KEYS.text_data(project_id, path_params)
  );
  if (cache) return cache;
  // raw.githubusercontent.com is faster but imposes a cache of 5 mins so currently using this
  const req = await fetch(
    `https://api.github.com/repos/shubhattin/thesanskritchannel_projects/contents/${loc}`,
    {
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${env.GITHUB_API_KEY}`,
        'X-GitHub-Api-Version': '2022-11-28'
      }
    }
  );
  const base_64_data = (await req.json())['content'];
  const buffer = Buffer.from(base_64_data, 'base64');
  const decoded_content = buffer.toString('utf-8');
  const data = JSON.parse(decoded_content) as shloka_list_type;
  await redis.set(REDIS_CACHE_KEYS.text_data(project_id, path_params), data, {
    ex: ms('30days') / 1000
  });
  return data;
};

const get_text_data_route = publicProcedure
  .input(
    z.object({
      project_key: z.string(),
      path_params: z.number().int().array()
    })
  )
  .query(async ({ input: { project_key, path_params } }) => {
    await delay(350);
    const data = await get_text_data_func(project_key, path_params);
    return data;
  });

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
      data = await db.query.translation.findMany({
        columns: {
          index: true,
          text: true
        },
        where: (tbl, { eq, and }) =>
          and(eq(tbl.project_id, project_id), eq(tbl.lang_id, lang_id), eq(tbl.path, path))
      });
      if (import.meta.env.PROD) {
        await redis.set(REDIS_CACHE_KEYS.translation(project_id, lang_id, path_params), data, {
          ex: ms('30days') / 1000
        });
      }
    }
    const data_map = new Map<number, string>();
    for (let i = 0; i < data.length; i++) data_map.set(data[i].index, data[i].text);
    return data_map;
  });

const edit_translation_route = protectedProcedure
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
        if (!user.is_approved) return { success: false };
        const languages = await get_languages_for_ptoject_user(user.id, project_id);
        const allowed_langs = languages.map((lang) => lang.lang_id);
        if (!allowed_langs || !allowed_langs.includes(lang_id)) return { success: false };
      }

      const exists_indexes = (
        await db
          .select({ index: translation.index })
          .from(translation)
          .where(
            and(
              eq(translation.project_id, project_id),
              eq(translation.lang_id, lang_id),
              eq(translation.path, path),
              inArray(translation.index, indexes)
            )
          )
      ).map((v) => v.index);

      const indexed_indexes = indexes.map((v, i) => [v, i]);
      const to_add_indexes = indexed_indexes.filter((index) => !exists_indexes.includes(index[0]));
      const to_edit_indexes = indexed_indexes.filter((index) => exists_indexes.includes(index[0]));

      // add new records
      if (to_add_indexes.length > 0) {
        const data_to_add = to_add_indexes.map(([index, i]) => ({
          project_id,
          lang_id,
          path,
          index: index,
          text: data[i]
        }));
        await db.insert(translation).values(data_to_add);
      }

      // update existing records
      const promises: Promise<any>[] = [];
      for (let _i = 0; _i < to_edit_indexes.length; _i++) {
        const [index, i] = to_edit_indexes[_i];
        const text = data[i];
        promises.push(
          db
            .update(translation)
            .set({ text })
            .where(
              and(
                eq(translation.project_id, project_id),
                eq(translation.lang_id, lang_id),
                eq(translation.path, path),
                eq(translation.index, index)
              )
            )
        );
      }
      promises.push(redis.del(REDIS_CACHE_KEYS.translation(project_id, lang_id, path_params)));

      // resolving update promises
      await Promise.allSettled(promises);

      return {
        success: true
      };
    }
  );

const get_all_langs_translation_route = protectedProcedure
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
    const data = await db.query.translation.findMany({
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
  get_text_data: get_text_data_route,
  get_translation: get_translation_route,
  edit_translation: edit_translation_route,
  get_all_langs_translation: get_all_langs_translation_route,
  trigger_translation_commit: trigger_translation_commit_route
});
