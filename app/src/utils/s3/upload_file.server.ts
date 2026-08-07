import { Effect } from 'effect';
import {
  buildImageAssetS3Key,
  isValidImageAssetS3Key,
  type ImageAssetS3Key
} from '~/utils/s3/image_asset_key';
import { ObjectStorage } from '~/effect/storage';
import { runServerEffect } from '~/effect/app_runtime.server';

export type { ImageAssetS3Key };
export { buildImageAssetS3Key, isValidImageAssetS3Key };

export const uploadAssetFile = (key: ImageAssetS3Key, fileBuffer: Buffer) =>
  runServerEffect(
    Effect.gen(function* () {
      const storage = yield* ObjectStorage;
      return yield* storage.uploadAssetFile(key, fileBuffer);
    })
  );

export const deleteAssetFile = (key: string) =>
  runServerEffect(
    Effect.gen(function* () {
      const storage = yield* ObjectStorage;
      return yield* storage.deleteAssetFile(key);
    })
  );

/** Fetch image asset bytes from S3 by validated key. */
export const getAssetFile = (key: string): Promise<Buffer> =>
  runServerEffect(
    Effect.gen(function* () {
      const storage = yield* ObjectStorage;
      return yield* storage.getAssetFile(key);
    })
  );
