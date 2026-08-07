import { eq } from 'drizzle-orm';
import { Effect } from 'effect';
import { image_assets, text_image_assets_join } from '~/db/schema';
import { dbRun, dbTransaction, type TxOrDb } from '~/effect/database';
import { ImageProcessor } from '~/effect/image';
import { ObjectStorage } from '~/effect/storage';
import { BadRequestError, StorageError } from '~/effect/errors';
import {
  buildImageAssetS3Key,
  isValidImageAssetS3Key,
  type ImageAssetS3Key
} from '~/utils/s3/image_asset_key';

export type PersistImageAssetInput = {
  project_id: number;
  project_path_id: number;
  path_params: readonly number[];
  index: number | null;
  /** Raw image bytes or base64 string (PNG/JPEG/WebP) */
  image: Buffer | string;
  description?: string | null;
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

/**
 * Compress → upload WebP → insert image_assets (+ optional text_image_assets_join).
 * Compensates by deleting the S3 object if the DB insert fails.
 */
export const persistImageAsset = Effect.fn('persistImageAsset')(function* (
  input: PersistImageAssetInput
) {
  const {
    project_id,
    project_path_id,
    path_params,
    index,
    image,
    description = null,
    create_join = true
  } = input;

  const imageProcessor = yield* ImageProcessor;
  const storage = yield* ObjectStorage;

  const compressed = yield* imageProcessor.compressToWebp(image);
  if (!compressed.width || !compressed.height) {
    return yield* Effect.fail(
      BadRequestError.make({ message: 'Compressed image is missing width/height metadata' })
    );
  }

  const s3_key = buildImageAssetS3Key(project_id, path_params, index);
  yield* storage.uploadAssetFile(s3_key, compressed.buffer);

  try {
    return yield* dbTransaction('persistImageAsset.insert', async (tx) => {
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

      if (!isValidImageAssetS3Key(asset.s3_key)) {
        throw new Error(`Invalid s3_key returned from DB: ${asset.s3_key}`);
      }

      if (create_join) {
        await tx.insert(text_image_assets_join).values({
          project_path_id,
          index,
          image_asset_id: asset.id
        });
      }

      return {
        id: asset.id,
        s3_key: asset.s3_key,
        width: asset.width,
        height: asset.height,
        description: asset.description
      } satisfies PersistImageAssetResult;
    });
  } catch (err) {
    yield* Effect.promise(() =>
      Effect.runPromise(storage.deleteAssetFile(s3_key)).catch((cleanup_err) => {
        console.error(`Failed to clean up S3 key after DB failure: ${s3_key}`, cleanup_err);
      })
    );
    return yield* Effect.fail(
      StorageError.make({ operation: 'persistImageAsset', key: s3_key, cause: err })
    );
  }
});

/** Link an already-uploaded image_assets row into text_image_assets_join. */
export const linkImageAssetToText = async (
  txOrDb: TxOrDb,
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
export const deleteImageAssetById = Effect.fn('deleteImageAssetById')(function* (image_id: number) {
  const storage = yield* ObjectStorage;

  const asset = yield* dbRun('deleteImageAssetById.lookup', (db) =>
    db.query.image_assets.findFirst({
      columns: { id: true, s3_key: true },
      where: eq(image_assets.id, image_id)
    })
  );
  if (!asset) {
    return { deleted: false as const };
  }

  yield* dbTransaction('deleteImageAssetById.db', async (tx) => {
    await tx
      .delete(text_image_assets_join)
      .where(eq(text_image_assets_join.image_asset_id, image_id));
    await tx.delete(image_assets).where(eq(image_assets.id, image_id));
  });

  const maxAttempts = 3;
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const result = yield* storage.deleteAssetFile(asset.s3_key).pipe(
      Effect.as({ ok: true as const }),
      Effect.catch((cause) => Effect.succeed({ ok: false as const, cause }))
    );
    if (result.ok) {
      return { deleted: true as const, s3_key: asset.s3_key };
    }
    lastError = result.cause;
    if (attempt < maxAttempts) {
      yield* Effect.sleep(`${200 * attempt} millis`);
    }
  }
  return yield* Effect.fail(
    StorageError.make({
      operation: 'deleteImageAssetById',
      key: asset.s3_key,
      cause: new Error(
        `Removed DB rows for image ${image_id}, but failed to delete S3 object ${asset.s3_key}: ${String(lastError)}`
      )
    })
  );
});
