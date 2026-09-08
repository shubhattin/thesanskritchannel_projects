import { Effect } from 'effect';
import { and, asc, eq, isNull, sql } from 'drizzle-orm';
import { z } from 'zod';
import { protectedAdminProcedure, t } from '~/api/trpc_init';
import { text_image_assets_join, texts, image_assets } from '~/db/schema';
import { dbRun } from '~/effect/database';
import { BadRequestError, NotFoundError } from '~/effect/errors';
import { runTrpcEffect } from '~/effect/app_runtime.server';
import { deleteImageAssetById } from '~/utils/image_assets/persist.server';
import { getCDNUrlSync } from '~/utils/cdn';
import { get_project_info_by_id } from '~/utils/project/list.server';
import { get_path_params } from '~/state/project_list';
import { getPresignedDownloadUrls } from '~/utils/s3/upload_file.server';

const path_input_schema = z.object({
  project_id: z.int(),
  selected_text_levels: z.array(z.int().nullable())
});

const list_images_input_schema = path_input_schema.extend({
  /** When set, only images for that index (or null = orphans only) */
  index: z.int().min(0).nullable().optional()
});

const require_project_path = Effect.fn('image_assets.require_project_path')(function* (
  project_id: number,
  path: string
) {
  const row = yield* dbRun('image_assets.require_path', (db) =>
    db.query.project_paths.findFirst({
      where: (tbl, { and: andOp, eq: eqOp }) =>
        andOp(eqOp(tbl.project_id, project_id), eqOp(tbl.path, path)),
      columns: { id: true, project_id: true, path: true }
    })
  );
  if (!row) {
    return yield* Effect.fail(
      NotFoundError.make({
        resource: 'project_path',
        message: `Project path not found: ${path}`
      })
    );
  }
  return row;
});

const list_text_images_route = protectedAdminProcedure
  .input(list_images_input_schema)
  .query(({ input }) =>
    runTrpcEffect(
      Effect.gen(function* () {
        const { levels } = yield* get_project_info_by_id(input.project_id);
        const path_params = get_path_params(input.selected_text_levels, levels);
        if (levels > 1 && path_params.length === 0) {
          return yield* Effect.fail(
            BadRequestError.make({ message: 'Invalid text path selection' })
          );
        }
        const projectPath = yield* require_project_path(input.project_id, path_params.join(':'));

        const index_filter =
          input.index === undefined
            ? undefined
            : input.index === null
              ? isNull(text_image_assets_join.index)
              : eq(text_image_assets_join.index, input.index);

        const rows = yield* dbRun('image_assets.ml.1', (db) =>
          db
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
            .orderBy(
              sql`${text_image_assets_join.index} ASC NULLS LAST`,
              asc(image_assets.created_at)
            )
        );

        return rows.map((row) => ({
          join_id: row.join_id,
          index: row.index,
          shloka_num: row.shloka_num,
          image: {
            id: row.image_asset_id,
            s3_key: row.s3_key,
            url: getCDNUrlSync(row.s3_key),
            width: row.width,
            height: row.height,
            description: row.description,
            created_at: row.created_at
          }
        }));
      })
    )
  );

const delete_text_image_route = protectedAdminProcedure
  .input(
    z.object({
      image_asset_id: z.int()
    })
  )
  .mutation(({ input: { image_asset_id } }) =>
    runTrpcEffect(
      Effect.gen(function* () {
        const result = yield* deleteImageAssetById(image_asset_id);
        if (!result.deleted) {
          return yield* Effect.fail(
            NotFoundError.make({
              resource: 'image_asset',
              message: 'Image asset not found'
            })
          );
        }
        return { success: true as const };
      })
    )
  );

const get_presigned_urls_route = protectedAdminProcedure
  .input(
    z.object({
      s3_keys: z.array(z.string().min(1)).min(1).max(200)
    })
  )
  .query(({ input }) =>
    runTrpcEffect(
      Effect.gen(function* () {
        const urls = yield* getPresignedDownloadUrls(input.s3_keys);
        return { urls };
      })
    )
  );

export const image_assets_router = t.router({
  list: list_text_images_route,
  delete: delete_text_image_route,
  get_presigned_urls: get_presigned_urls_route
});
