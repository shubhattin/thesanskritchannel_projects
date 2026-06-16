import { z } from 'zod';
import { t, protectedProcedure, protectedAdminProcedure } from '../trpc_init';
import { cache_db_options_app } from '~/utils/cache.server/cache_db_options.server';
import { CACHE, invalidate_and_refresh_cached } from '~/utils/cache.server/cached_loader.server';
import { get_project_info_by_id } from '~/utils/project/list.server';
import { db } from '~/db/db';
import { get_path_params } from '~/state/project_list';
import { requireProjectPath } from '~/utils/project/paths_db.server';
import { apply_multimedia_save } from '~/utils/media_save.server';

const media_type_schema = z.enum(['pdf', 'text', 'video', 'audio']);

const media_create_schema = z.object({
  client_id: z.uuid(),
  media_type: media_type_schema,
  link: z.url(),
  name: z.string().min(1),
  lang_id: z.int().nullable(),
  order: z.int().min(0)
});

const media_update_schema = z
  .object({
    id: z.int(),
    media_type: media_type_schema.optional(),
    link: z.url().optional(),
    name: z.string().min(1).optional(),
    lang_id: z.int().nullable().optional()
  })
  .refine(
    (data) =>
      data.media_type !== undefined ||
      data.link !== undefined ||
      data.name !== undefined ||
      data.lang_id !== undefined,
    { message: 'Update must include at least one field' }
  );

const get_media_list_route = protectedProcedure
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

const save_project_multimedia_route = protectedAdminProcedure
  .input(
    z.object({
      project_id: z.int(),
      selected_text_levels: z.array(z.int().nullable()),
      creates: z.array(media_create_schema).default([]),
      updates: z.array(media_update_schema).default([]),
      deletes: z.array(z.int()).default([]),
      order_updates: z.array(z.object({ id: z.int(), order: z.int().min(0) })).default([])
    })
  )
  .mutation(
    async ({
      input: { project_id, selected_text_levels, creates, updates, deletes, order_updates }
    }) => {
      const { levels } = await get_project_info_by_id(project_id, cache_db_options_app);
      const path_params = get_path_params(selected_text_levels, levels);

      const result = await db.transaction(async (tx) => {
        const projectPath = await requireProjectPath(tx, project_id, path_params.join(':'));
        return apply_multimedia_save(tx, projectPath.id, {
          creates,
          updates,
          deletes,
          order_updates
        });
      });

      await invalidate_and_refresh_cached(
        CACHE.media_links,
        { project_id, path_params },
        cache_db_options_app
      );

      return result;
    }
  );

export const media_router = t.router({
  get_media_list: get_media_list_route,
  save_project_multimedia: save_project_multimedia_route
});
