import { z } from 'zod';
import { t, publicProcedure, protectedAdminProcedure } from '../trpc_init';
import { db } from '~/db/db';
import { REDIS_CACHE_KEYS } from '~/db/redis';
import { media_attachment, project_paths } from '~/db/schema';
import ms from 'ms';
import { eq } from 'drizzle-orm';
import { get_path_params } from '~/state/project_list';
import { requireProjectPath } from '~/server/project_paths_db.server';
import {
  get_project_info_by_id_effect,
  redis_del_effect,
  redis_get_effect,
  redis_set_effect,
  runAppEffect
} from '~/server/effect';

/** DB root path is `''`; cache keys use `[]`, not `[0]` from `''.split(':')`. */
const path_params_from_db_path = (path: string): number[] =>
  path === '' ? [] : path.split(':').map(Number);

const get_media_list_route = publicProcedure
  .input(
    z.object({
      project_id: z.int(),
      selected_text_levels: z.array(z.int().nullable())
    })
  )
  .query(async ({ input: { project_id, selected_text_levels } }) => {
    const { levels } = await runAppEffect(get_project_info_by_id_effect(project_id));
    const path_params = get_path_params(selected_text_levels, levels);
    type return_type = {
      id: number;
      lang_id: number | null;
      media_type: string;
      link: string;
      name: string;
    }[];
    const cacheKey = REDIS_CACHE_KEYS.media_links(project_id, path_params);
    const cache = await runAppEffect(redis_get_effect<return_type>(cacheKey));
    if (cache) return cache;

    const path = path_params.join(':');
    const projectPath = await requireProjectPath(db, project_id, path);
    const media_list = await db
      .select({
        id: media_attachment.id,
        link: media_attachment.link,
        media_type: media_attachment.media_type,
        lang_id: media_attachment.lang_id,
        name: media_attachment.name
      })
      .from(media_attachment)
      .where(eq(media_attachment.project_path_id, projectPath.id));
    await runAppEffect(redis_set_effect(cacheKey, media_list, { ex: ms('30days') / 1000 }));

    return media_list satisfies return_type;
  });

const add_media_link_route = protectedAdminProcedure
  .input(
    z.object({
      project_id: z.int(),
      lang_id: z.int().nullable(),
      media_type: z.enum(['pdf', 'text', 'video', 'audio']),
      link: z.url(),
      name: z.string().min(1),
      selected_text_levels: z.array(z.int().nullable())
    })
  )
  .mutation(
    async ({ input: { project_id, lang_id, link, media_type, selected_text_levels, name } }) => {
      const { levels } = await runAppEffect(get_project_info_by_id_effect(project_id));
      const path_params = get_path_params(selected_text_levels, levels);
      const projectPath = await requireProjectPath(db, project_id, path_params.join(':'));
      const [inserted] = await Promise.all([
        db
          .insert(media_attachment)
          .values({
            project_path_id: projectPath.id,
            lang_id,
            link,
            media_type,
            name
          })
          .returning()
      ]);
      await Promise.allSettled([
        runAppEffect(redis_del_effect(REDIS_CACHE_KEYS.media_links(project_id, path_params)))
      ]);

      return {
        id: inserted[0].id
      };
    }
  );

const update_media_link_route = protectedAdminProcedure
  .input(
    z.object({
      id: z.int(),
      project_id: z.int(),
      lang_id: z.int().nullable(),
      media_type: z.enum(['pdf', 'text', 'video', 'audio']),
      link: z.url(),
      name: z.string().min(1),
      selected_text_levels: z.array(z.int().nullable())
    })
  )
  .mutation(async ({ input: { id, lang_id, link, media_type, name } }) => {
    const existing = await db
      .select({ project_id: project_paths.project_id, path: project_paths.path })
      .from(media_attachment)
      .innerJoin(project_paths, eq(media_attachment.project_path_id, project_paths.id))
      .where(eq(media_attachment.id, id))
      .limit(1);
    const row = existing[0];
    if (!row) throw new Error('Media link not found');
    const path_params = path_params_from_db_path(row.path);

    await Promise.all([
      db
        .update(media_attachment)
        .set({ link, media_type, name, lang_id })
        .where(eq(media_attachment.id, id))
    ]);
    await Promise.allSettled([
      runAppEffect(redis_del_effect(REDIS_CACHE_KEYS.media_links(row.project_id, path_params)))
    ]);
    return {
      success: true
    };
  });

const delete_media_link_route = protectedAdminProcedure
  .input(
    z.object({
      link_id: z.int(),
      project_id: z.int(),
      selected_text_levels: z.array(z.int().nullable())
    })
  )
  .mutation(async ({ input: { link_id } }) => {
    const existing = await db
      .select({ project_id: project_paths.project_id, path: project_paths.path })
      .from(media_attachment)
      .innerJoin(project_paths, eq(media_attachment.project_path_id, project_paths.id))
      .where(eq(media_attachment.id, link_id))
      .limit(1);
    const row = existing[0];
    if (!row) throw new Error('Media link not found');
    const path_params = path_params_from_db_path(row.path);

    await Promise.allSettled([db.delete(media_attachment).where(eq(media_attachment.id, link_id))]);
    await Promise.allSettled([
      runAppEffect(redis_del_effect(REDIS_CACHE_KEYS.media_links(row.project_id, path_params)))
    ]);
    return {
      success: true
    };
  });

export const media_router = t.router({
  get_media_list: get_media_list_route,
  add_media_link: add_media_link_route,
  delete_media_link: delete_media_link_route,
  update_media_link: update_media_link_route
});
