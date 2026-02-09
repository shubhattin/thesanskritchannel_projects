import { z } from 'zod';
import { t, publicProcedure, protectedAdminProcedure } from '../trpc_init';
import { get_project_info_from_id } from '~/state/project_list';
import { db } from '~/db/db';
import { MediaAttachmentSchemaZod } from '~/db/schema_zod';
import { redis, REDIS_CACHE_KEYS } from '~/db/redis';
import { media_attachment } from '~/db/schema';
import ms from 'ms';
import { eq } from 'drizzle-orm';
import { get_path_params } from '~/state/project_list';

const get_media_list_route = publicProcedure
  .input(
    z.object({
      project_id: z.int(),
      selected_text_levels: z.array(z.int().nullable())
    })
  )
  .query(async ({ input: { project_id, selected_text_levels } }) => {
    const { levels } = await get_project_info_from_id(project_id);
    const path_params = get_path_params(
      selected_text_levels,
      levels
    );
    type return_type = {
      id: number;
      lang_id: number;
      media_type: string;
      link: string;
      name: string;
    }[];
    const cache = await redis.get<return_type>(
      REDIS_CACHE_KEYS.media_links(project_id, path_params)
    );
    if (cache) return cache;

    const path = path_params.join(':');
    const media_list = await db.query.media_attachment.findMany({
      columns: {
        id: true,
        link: true,
        media_type: true,
        lang_id: true,
        name: true
      },
      where: (tbl, { eq, and }) => and(eq(tbl.project_id, project_id), eq(tbl.path, path))
    });
    await redis.set(REDIS_CACHE_KEYS.media_links(project_id, path_params), media_list, {
      ex: ms('30days') / 1000
    });

    return media_list satisfies return_type;
  });

const add_media_link_route = protectedAdminProcedure
  .input(
    MediaAttachmentSchemaZod.omit({
      id: true,
      path: true
    }).extend({
      selected_text_levels: z.array(z.int().nullable())
    })
  )
  .mutation(
    async ({ input: { project_id, lang_id, link, media_type, selected_text_levels, name } }) => {
      const { levels } = await get_project_info_from_id(project_id);
      const path_params = get_path_params(
        selected_text_levels,
        levels
      );
      const path = path_params.join(':');
      const [inserted] = await Promise.all([
        db
          .insert(media_attachment)
          .values({
            project_id,
            lang_id,
            path,
            link,
            media_type,
            name
          })
          .returning()
      ]);
      await Promise.allSettled([redis.del(REDIS_CACHE_KEYS.media_links(project_id, path_params))]);

      return {
        id: inserted[0].id
      };
    }
  );

const update_media_link_route = protectedAdminProcedure
  .input(
    MediaAttachmentSchemaZod.omit({ path: true }).extend({
      project_id: z.int(),
      selected_text_levels: z.array(z.int().nullable())
    })
  )
  .mutation(
    async ({
      input: { project_id, selected_text_levels, id, lang_id, link, media_type, name }
    }) => {
      const { levels } = await get_project_info_from_id(project_id);
      const path_params = get_path_params(
        selected_text_levels,
        levels
      );
      // const path = path_params.join(':');

      await Promise.all([
        db
          .update(media_attachment)
          .set({ link, media_type, name, lang_id })
          .where(eq(media_attachment.id, id))
      ]);
      await Promise.allSettled([redis.del(REDIS_CACHE_KEYS.media_links(project_id, path_params))]);
      return {
        success: true
      };
    }
  );

const delete_media_link_route = protectedAdminProcedure
  .input(
    z.object({
      project_id: z.int(),
      link_id: z.int(),
      selected_text_levels: z.array(z.int().nullable())
    })
  )
  .mutation(async ({ input: { link_id, project_id, selected_text_levels } }) => {
    const { levels } = await get_project_info_from_id(project_id);
    const path_params = get_path_params(
      selected_text_levels,
      levels
    );

    // await db.delete(media_attachment).where((tbl, { eq }) => eq(tbl.id, link_id));
    await Promise.allSettled([db.delete(media_attachment).where(eq(media_attachment.id, link_id))]);
    await Promise.allSettled([redis.del(REDIS_CACHE_KEYS.media_links(project_id, path_params))]);
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
