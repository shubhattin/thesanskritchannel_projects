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

const concatBytes = (chunks: Uint8Array[]): Uint8Array => {
  let length = 0;
  for (const chunk of chunks) length += chunk.byteLength;
  const out = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    out.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return out;
};

type S3ResponseChunk = Uint8Array | ArrayBuffer | ArrayBufferView;

type S3ResponseBody =
  | Uint8Array
  | Blob
  | ReadableStream<Uint8Array>
  | AsyncIterable<S3ResponseChunk>
  | null
  | undefined;

const isReadableStream = (stream: S3ResponseBody): stream is ReadableStream<Uint8Array> =>
  stream != null && 'getReader' in stream;

const isAsyncIterable = (stream: S3ResponseBody): stream is AsyncIterable<S3ResponseChunk> =>
  stream != null && Symbol.asyncIterator in stream;

/**
 * workerd + `nodejs_compat` can hand back a Node Readable as a `fetch`
 * `Response.body`. The AWS browser runtime always calls `stream.getReader()`,
 * which that body does not have — after PutObject already returned HTTP 200.
 */
const collectS3ResponseBody = async (stream: S3ResponseBody): Promise<Uint8Array> => {
  if (stream == null) return new Uint8Array();
  if (stream instanceof Uint8Array) return stream;
  if (stream instanceof Blob) {
    return new Uint8Array(await stream.arrayBuffer());
  }
  if (isReadableStream(stream)) {
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }
  if (isAsyncIterable(stream)) {
    const chunks: Uint8Array[] = [];
    for await (const chunk of stream) {
      if (chunk instanceof Uint8Array) {
        chunks.push(chunk);
      } else if (chunk instanceof ArrayBuffer) {
        chunks.push(new Uint8Array(chunk));
      } else if (ArrayBuffer.isView(chunk)) {
        chunks.push(new Uint8Array(chunk.buffer, chunk.byteOffset, chunk.byteLength));
      }
    }
    return concatBytes(chunks);
  }
  return new Uint8Array();
};

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
      const bucket = config.awsS3BucketName;
      // Construct on first use. `new S3Client()` loads the Node AWS runtime
      // (`runtimeConfig.js`), whose named imports break under workerd's module
      // runner — see the `awsS3WorkersRuntime` remap in vite.config.ts.
      let s3: S3Client | undefined;
      const getS3 = () =>
        (s3 ??= new S3Client({
          region: config.awsRegion,
          credentials: {
            accessKeyId: config.awsAccessKeyId,
            secretAccessKey: Redacted.value(config.awsSecretAccessKey)
          },
          // AWS SDK 3.729+ defaults checksums to WHEN_SUPPORTED (Node/wasm CRC32).
          requestChecksumCalculation: 'WHEN_REQUIRED',
          responseChecksumValidation: 'WHEN_REQUIRED',
          streamCollector: collectS3ResponseBody
        }));

      return {
        uploadAssetFile: (key, fileBuffer) =>
          tryStorage('uploadAssetFile', key, async () => {
            if (!isValidImageAssetS3Key(key)) {
              throw new Error(`Invalid asset key: ${key}`);
            }
            const uploadParams: PutObjectCommandInput = {
              Bucket: bucket,
              Key: key,
              Body: Uint8Array.from(fileBuffer),
              ContentType: mime.lookup(key) || 'application/octet-stream',
              StorageClass: StorageClass.STANDARD
            };
            return getS3().send(new PutObjectCommand(uploadParams));
          }),
        deleteAssetFile: (key) =>
          tryStorage('deleteAssetFile', key, async () => {
            if (!isValidImageAssetS3Key(key)) {
              throw new Error(`Invalid asset key: ${key}`);
            }
            return getS3().send(
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
            const result = await getS3().send(
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
                getS3(),
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
