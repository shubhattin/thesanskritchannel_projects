import { z } from 'zod';
import { t, publicProcedure } from '../trpc_init';
import { get_levels, server_get_path_params } from './translation';
import { get_project_info_from_id } from '~/state/project_list';
import { db } from '~/db/db';

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

    const { first, second } = get_levels(selected_text_levels);
    const media_list = await db.query.media_attachment.findMany({
      columns: {
        id: true,
        link: true,
        type: true,
        lang_id: true
      },
      where: (tbl, { eq, and }) =>
        and(eq(tbl.project_id, project_id), eq(tbl.first, first), eq(tbl.second, second))
    });

    return media_list;
  });

export const media_router = t.router({
  get_media_list: get_media_list_route
});
