import { Context, Effect, Layer, Redacted } from 'effect';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
  StorageClass,
  type PutObjectCommandInput
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import mime from 'mime-types';
import { isValidImageAssetS3Key, type ImageAssetS3Key } from '~/utils/s3/image_asset_key';
import { AppConfig } from './config';
import { StorageError } from './errors';

export type { ImageAssetS3Key };

/** Presigned GET URL lifetime for browser downloads. */
export const PRESIGNED_DOWNLOAD_EXPIRES_IN_SECONDS = 10 * 60;

const tryStorage = <A>(operation: string, key: string | undefined, run: () => Promise<A>) =>
  Effect.tryPromise({
    try: run,
    catch: (cause) => StorageError.make({ operation, key, cause })
  }).pipe(Effect.annotateLogs({ category: 'storage', operation, key }));

export class ObjectStorage extends Context.Service<
  ObjectStorage,
  {
    readonly uploadAssetFile: (
      key: ImageAssetS3Key,
      fileBuffer: Buffer
    ) => Effect.Effect<unknown, StorageError>;
    readonly deleteAssetFile: (key: string) => Effect.Effect<unknown, StorageError>;
    readonly getAssetFile: (key: string) => Effect.Effect<Buffer, StorageError>;
    /** Publicly fetchable GET URLs (10 min). Keys must be valid image asset keys. */
    readonly getPresignedDownloadUrls: (
      keys: readonly string[]
    ) => Effect.Effect<Record<string, string>, StorageError>;
  }
>()('ObjectStorage') {
  static readonly Live = Layer.effect(ObjectStorage)(
    Effect.gen(function* () {
      const config = yield* AppConfig;
      const s3 = new S3Client({
        region: config.awsRegion,
        credentials: {
          accessKeyId: config.awsAccessKeyId,
          secretAccessKey: Redacted.value(config.awsSecretAccessKey)
        }
      });
      const bucket = config.awsS3BucketName;

      return {
        uploadAssetFile: (key, fileBuffer) =>
          tryStorage('uploadAssetFile', key, async () => {
            if (!isValidImageAssetS3Key(key)) {
              throw new Error(`Invalid asset key: ${key}`);
            }
            const uploadParams: PutObjectCommandInput = {
              Bucket: bucket,
              Key: key,
              Body: fileBuffer,
              ContentType: mime.lookup(key) || 'application/octet-stream',
              StorageClass: StorageClass.STANDARD
            };
            return s3.send(new PutObjectCommand(uploadParams));
          }),
        deleteAssetFile: (key) =>
          tryStorage('deleteAssetFile', key, async () => {
            if (!isValidImageAssetS3Key(key)) {
              throw new Error(`Invalid asset key: ${key}`);
            }
            return s3.send(
              new DeleteObjectCommand({
                Bucket: bucket,
                Key: key
              })
            );
          }),
        getAssetFile: (key) =>
          tryStorage('getAssetFile', key, async () => {
            if (!isValidImageAssetS3Key(key)) {
              throw new Error(`Invalid asset key: ${key}`);
            }
            const result = await s3.send(
              new GetObjectCommand({
                Bucket: bucket,
                Key: key
              })
            );
            const bytes = await result.Body?.transformToByteArray();
            if (!bytes) {
              throw new Error(`Empty S3 object body for key: ${key}`);
            }
            return Buffer.from(bytes);
          }),
        getPresignedDownloadUrls: (keys) =>
          tryStorage('getPresignedDownloadUrls', keys[0], async () => {
            const urls: Record<string, string> = {};
            for (const key of keys) {
              if (!isValidImageAssetS3Key(key)) {
                throw new Error(`Invalid asset key: ${key}`);
              }
              urls[key] = await getSignedUrl(
                s3,
                new GetObjectCommand({ Bucket: bucket, Key: key }),
                { expiresIn: PRESIGNED_DOWNLOAD_EXPIRES_IN_SECONDS }
              );
            }
            return urls;
          })
      };
    })
  );
}
