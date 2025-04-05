import { z } from 'zod';
import { t, publicProcedure, protectedAdminProcedure } from '../trpc_init';
import { get_levels, server_get_path_params } from './translation';
import { get_project_info_from_id } from '~/state/project_list';
import { db } from '~/db/db';
import { MediaAttachmentSchemaZod } from '~/db/schema_zod';
import { redis, REDIS_CACHE_KEYS } from '~/db/redis';
import { media_attachment } from '~/db/schema';
import ms from 'ms';
import { eq } from 'drizzle-orm';

const get_media_list_route = publicProcedure
  .input(
    z.object({
      project_id: z.number().int(),
      selected_text_levels: z.array(z.number().int().nullable())
    })
  )
  .query(async ({ input: { project_id, selected_text_levels } }) => {
    const path_params = server_get_path_params(
      selected_text_levels,
      get_project_info_from_id(project_id).levels
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

    const { first, second } = get_levels(selected_text_levels);
    const media_list = await db.query.media_attachment.findMany({
      columns: {
        id: true,
        link: true,
        media_type: true,
        lang_id: true,
        name: true
      },
      where: (tbl, { eq, and }) =>
        and(eq(tbl.project_id, project_id), eq(tbl.first, first), eq(tbl.second, second))
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
      first: true,
      second: true
    }).extend({
      selected_text_levels: z.array(z.number().int().nullable())
    })
  )
  .mutation(
    async ({ input: { project_id, lang_id, link, media_type, selected_text_levels, name } }) => {
      const path_params = server_get_path_params(
        selected_text_levels,
        get_project_info_from_id(project_id).levels
      );

      const { first, second } = get_levels(selected_text_levels);
      const [inserted] = await Promise.all([
        db
          .insert(media_attachment)
          .values({
            project_id,
            lang_id,
            first,
            second,
            link,
            media_type,
            name
          })
          .returning(),
        redis.del(REDIS_CACHE_KEYS.media_links(project_id, path_params))
      ]);

      return {
        id: inserted[0].id
      };
    }
  );

export const delete_media_link_route = protectedAdminProcedure
  .input(
    z.object({
      project_id: z.number().int(),
      link_id: z.number().int(),
      selected_text_levels: z.array(z.number().int().nullable())
    })
  )
  .mutation(async ({ input: { link_id, project_id, selected_text_levels } }) => {
    const path_params = server_get_path_params(
      selected_text_levels,
      get_project_info_from_id(project_id).levels
    );

    // await db.delete(media_attachment).where((tbl, { eq }) => eq(tbl.id, link_id));
    await Promise.all([
      db.delete(media_attachment).where(eq(media_attachment.id, link_id)),
      redis.del(REDIS_CACHE_KEYS.media_links(project_id, path_params))
    ]);
    return {
      success: true
    };
  });

export const media_router = t.router({
  get_media_list: get_media_list_route,
  add_media_link: add_media_link_route
});
