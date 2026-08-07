import { Effect } from 'effect';
import {
  buildImageAssetS3Key,
  isValidImageAssetS3Key,
  type ImageAssetS3Key
} from '~/utils/s3/image_asset_key';
import { ObjectStorage } from '~/effect/storage';

export type { ImageAssetS3Key };
export { buildImageAssetS3Key, isValidImageAssetS3Key };

export const uploadAssetFile = (key: ImageAssetS3Key, fileBuffer: Buffer) =>
  Effect.gen(function* () {
    const storage = yield* ObjectStorage;
    return yield* storage.uploadAssetFile(key, fileBuffer);
  });

export const deleteAssetFile = (key: string) =>
  Effect.gen(function* () {
    const storage = yield* ObjectStorage;
    return yield* storage.deleteAssetFile(key);
  });

/** Fetch image asset bytes from S3 by validated key. */
export const getAssetFile = (key: string) =>
  Effect.gen(function* () {
    const storage = yield* ObjectStorage;
    return yield* storage.getAssetFile(key);
  });

/** Presigned GET URLs for browser download (10 min TTL). */
export const getPresignedDownloadUrls = (keys: readonly string[]) =>
  Effect.gen(function* () {
    const storage = yield* ObjectStorage;
    return yield* storage.getPresignedDownloadUrls(keys);
  });
