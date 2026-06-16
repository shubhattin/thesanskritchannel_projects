import { z } from 'zod';
import { t, publicProcedure, protectedAdminProcedure } from '../trpc_init';
import { cache_db_options_app } from '~/utils/cache.server/cache_db_options.server';
import { CACHE, invalidate_and_refresh_cached } from '~/utils/cache.server/cached_loader.server';
import { get_project_info_by_id } from '~/utils/project/list.server';
import { db } from '~/db/db';
import { media_attachment, project_paths } from '~/db/schema';
import { eq } from 'drizzle-orm';
import { get_path_params } from '~/state/project_list';
import { requireProjectPath } from '~/utils/project/paths_db.server';

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
    const { levels } = await get_project_info_by_id(project_id, cache_db_options_app);
    const path_params = get_path_params(selected_text_levels, levels);
    return CACHE.media_links.get({ project_id, path_params }, cache_db_options_app);
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
      const { levels } = await get_project_info_by_id(project_id, cache_db_options_app);
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
      await invalidate_and_refresh_cached(
        CACHE.media_links,
        { project_id, path_params },
        cache_db_options_app
      );

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
    await invalidate_and_refresh_cached(
      CACHE.media_links,
      { project_id: row.project_id, path_params },
      cache_db_options_app
    );
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
    await invalidate_and_refresh_cached(
      CACHE.media_links,
      { project_id: row.project_id, path_params },
      cache_db_options_app
    );
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
