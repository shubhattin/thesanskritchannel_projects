import { eq } from 'drizzle-orm';
import type { S3Client } from '@aws-sdk/client-s3';
import { db, type transactionType } from '~/db/db';
import { image_assets, text_image_assets_join } from '~/db/schema';
import { compress_to_webp } from '~/utils/sharp/lossweb_compress';
import {
  buildImageAssetS3Key,
  createS3Client,
  deleteAssetFile,
  uploadAssetFile,
  type ImageAssetS3Key
} from '~/utils/s3/upload_file.server';

export type PersistImageAssetInput = {
  project_id: number;
  project_path_id: number;
  path_params: readonly number[];
  index: number | null;
  /** Raw image bytes or base64 string (PNG/JPEG/WebP) */
  image: Buffer | string;
  description?: string | null;
  s3Client?: S3Client;
  /** When false, only upload + insert image_assets (batch staging). Default true. */
  create_join?: boolean;
};

export type PersistImageAssetResult = {
  id: number;
  s3_key: ImageAssetS3Key;
  width: number;
  height: number;
  description: string | null;
};

const getS3 = (client?: S3Client) => client ?? createS3Client();

/**
 * Compress → upload WebP → insert image_assets (+ optional text_image_assets_join).
 * Compensates by deleting the S3 object if the DB insert fails.
 */
export const persistImageAsset = async (
  input: PersistImageAssetInput
): Promise<PersistImageAssetResult> => {
  const {
    project_id,
    project_path_id,
    path_params,
    index,
    image,
    description = null,
    create_join = true
  } = input;
  const s3Client = getS3(input.s3Client);

  const compressed = await compress_to_webp(image);
  if (!compressed.width || !compressed.height) {
    throw new Error('Compressed image is missing width/height metadata');
  }

  const s3_key = buildImageAssetS3Key(project_id, path_params, index);
  await uploadAssetFile(s3_key, compressed.buffer, { s3Client });

  try {
    const result = await db.transaction(async (tx) => {
      const [asset] = await tx
        .insert(image_assets)
        .values({
          s3_key,
          width: compressed.width,
          height: compressed.height,
          description: description?.slice(0, 150) ?? null
        })
        .returning();

      if (!asset) throw new Error('Failed to insert image_assets row');

      if (create_join) {
        await tx.insert(text_image_assets_join).values({
          project_path_id,
          index,
          image_asset_id: asset.id
        });
      }

      return {
        id: asset.id,
        s3_key: asset.s3_key as ImageAssetS3Key,
        width: asset.width,
        height: asset.height,
        description: asset.description
      };
    });
    return result;
  } catch (err) {
    await deleteAssetFile(s3_key, { s3Client }).catch((cleanup_err) => {
      console.error(`Failed to clean up S3 key after DB failure: ${s3_key}`, cleanup_err);
    });
    throw err;
  }
};

/** Link an already-uploaded image_assets row into text_image_assets_join. */
export const linkImageAssetToText = async (
  txOrDb: transactionType,
  args: {
    project_path_id: number;
    index: number | null;
    image_asset_id: number;
  }
) => {
  const [row] = await txOrDb
    .insert(text_image_assets_join)
    .values({
      project_path_id: args.project_path_id,
      index: args.index,
      image_asset_id: args.image_asset_id
    })
    .onConflictDoNothing({ target: text_image_assets_join.image_asset_id })
    .returning();
  return row ?? null;
};

/**
 * Delete text_image_assets_join + image_assets row, then remove the S3 object.
 * DB first so a failed S3 delete can be retried without orphan joins (cascade also
 * clears joins / texts.image_id via FK).
 */
export const deleteImageAssetById = async (image_id: number, options?: { s3Client?: S3Client }) => {
  const s3Client = getS3(options?.s3Client);
  const asset = await db.query.image_assets.findFirst({
    columns: { id: true, s3_key: true },
    where: eq(image_assets.id, image_id)
  });
  if (!asset) {
    return { deleted: false as const };
  }

  await db.transaction(async (tx) => {
    await tx
      .delete(text_image_assets_join)
      .where(eq(text_image_assets_join.image_asset_id, image_id));
    await tx.delete(image_assets).where(eq(image_assets.id, image_id));
  });

  const maxAttempts = 3;
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      await deleteAssetFile(asset.s3_key, { s3Client });
      return { deleted: true as const, s3_key: asset.s3_key };
    } catch (err) {
      lastError = err;
      if (attempt < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 200 * attempt));
      }
    }
  }
  throw new Error(
    `Removed DB rows for image ${image_id}, but failed to delete S3 object ${asset.s3_key}: ${String(lastError)}`
  );
};
