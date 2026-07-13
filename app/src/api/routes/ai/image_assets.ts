import { and, asc, eq, isNull, sql } from 'drizzle-orm';
import { TRPCError } from '@trpc/server';
import { z } from 'zod';
import { protectedAdminProcedure, t } from '~/api/trpc_init';
import { db } from '~/db/db';
import { text_image_assets_join, texts, image_assets } from '~/db/schema';
import { resolveSelectedTextProjectPath } from '~/utils/project/paths_db.server';
import { deleteImageAssetById } from '~/utils/image_assets/persist.server';
import { getCDNUrl } from '~/constants';

const path_input_schema = z.object({
  project_id: z.int(),
  selected_text_levels: z.array(z.int().nullable())
});

const list_images_input_schema = path_input_schema.extend({
  /** When set, only images for that index (or null = orphans only) */
  index: z.int().min(0).nullable().optional()
});

const list_text_images_route = protectedAdminProcedure
  .input(list_images_input_schema)
  .query(async ({ input }) => {
    const { projectPath } = await resolveSelectedTextProjectPath(
      db,
      input.project_id,
      input.selected_text_levels
    );

    const index_filter =
      input.index === undefined
        ? undefined
        : input.index === null
          ? isNull(text_image_assets_join.index)
          : eq(text_image_assets_join.index, input.index);

    const rows = await db
      .select({
        join_id: text_image_assets_join.id,
        index: text_image_assets_join.index,
        image_asset_id: image_assets.id,
        s3_key: image_assets.s3_key,
        width: image_assets.width,
        height: image_assets.height,
        description: image_assets.description,
        created_at: image_assets.created_at,
        shloka_num: texts.shloka_num
      })
      .from(text_image_assets_join)
      .innerJoin(image_assets, eq(text_image_assets_join.image_asset_id, image_assets.id))
      .leftJoin(
        texts,
        and(
          eq(texts.project_path_id, text_image_assets_join.project_path_id),
          sql`${texts.index} = ${text_image_assets_join.index}`
        )
      )
      .where(and(eq(text_image_assets_join.project_path_id, projectPath.id), index_filter))
      .orderBy(sql`${text_image_assets_join.index} ASC NULLS LAST`, asc(image_assets.created_at));

    return rows.map((row) => ({
      join_id: row.join_id,
      index: row.index,
      shloka_num: row.shloka_num,
      image: {
        id: row.image_asset_id,
        s3_key: row.s3_key,
        url: getCDNUrl(row.s3_key),
        width: row.width,
        height: row.height,
        description: row.description,
        created_at: row.created_at
      }
    }));
  });

const delete_text_image_route = protectedAdminProcedure
  .input(
    z.object({
      image_asset_id: z.int()
    })
  )
  .mutation(async ({ input: { image_asset_id } }) => {
    const result = await deleteImageAssetById(image_asset_id);
    if (!result.deleted) {
      throw new TRPCError({ code: 'NOT_FOUND', message: 'Image asset not found' });
    }
    return { success: true as const };
  });

export const image_assets_router = t.router({
  list: list_text_images_route,
  delete: delete_text_image_route
});
