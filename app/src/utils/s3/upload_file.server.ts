import { z } from 'zod';
import mime from 'mime-types';
import type { PutObjectCommandInput } from '@aws-sdk/client-s3';
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
  StorageClass
} from '@aws-sdk/client-s3';
import { env } from '$env/dynamic/private';
import {
  buildImageAssetS3Key,
  isValidImageAssetS3Key,
  type ImageAssetS3Key
} from '~/utils/s3/image_asset_key';

export type { ImageAssetS3Key };
export { buildImageAssetS3Key, isValidImageAssetS3Key };

const envs_schema = z.object({
  AWS_REGION: z.string().min(1),
  AWS_ACCESS_KEY_ID: z.string().min(1),
  AWS_SECRET_ACCESS_KEY: z.string().min(1),
  AWS_S3_FILES_BUCKET_NAME: z.string().min(1)
});

export const createS3Client = (options?: { envs?: z.infer<typeof envs_schema> }) => {
  const envs = envs_schema.parse(options?.envs ?? env);
  return new S3Client({
    region: envs.AWS_REGION,
    credentials: {
      accessKeyId: envs.AWS_ACCESS_KEY_ID,
      secretAccessKey: envs.AWS_SECRET_ACCESS_KEY
    }
  });
};

type UploadFileOptions = {
  s3Client: S3Client;
};

async function uploadFile(
  bucketName: string,
  key: string,
  fileBuffer: Buffer,
  options: UploadFileOptions
) {
  const { s3Client } = options;
  const uploadParams: PutObjectCommandInput = {
    Bucket: bucketName,
    Key: key,
    Body: fileBuffer,
    ContentType: mime.lookup(key) || 'application/octet-stream',
    StorageClass: StorageClass.STANDARD
  };

  const data = await s3Client.send(new PutObjectCommand(uploadParams));
  return data;
}

const getAssetBucketName = () => {
  const bucket = env.AWS_S3_FILES_BUCKET_NAME;
  if (!bucket) {
    throw new Error('AWS_S3_FILES_BUCKET_NAME is not configured');
  }
  return bucket;
};

export const uploadAssetFile = async (
  key: ImageAssetS3Key,
  fileBuffer: Buffer,
  options: UploadFileOptions & {
    assetBucketName?: string;
  }
) => {
  const data = await uploadFile(
    options.assetBucketName ?? getAssetBucketName(),
    key,
    fileBuffer,
    options
  );
  return data;
};

export const deleteAssetFile = async (
  key: string,
  options: UploadFileOptions & {
    assetBucketName?: string;
  }
) => {
  const { s3Client } = options;
  if (!isValidImageAssetS3Key(key)) {
    throw new Error(`Invalid asset key: ${key}`);
  }

  const data = await s3Client.send(
    new DeleteObjectCommand({
      Bucket: options.assetBucketName ?? getAssetBucketName(),
      Key: key
    })
  );
  return data;
};

/** Fetch image asset bytes from S3 by validated key. */
export const getAssetFile = async (
  key: string,
  options: UploadFileOptions & {
    assetBucketName?: string;
  }
): Promise<Buffer> => {
  if (!isValidImageAssetS3Key(key)) {
    throw new Error(`Invalid asset key: ${key}`);
  }

  const result = await options.s3Client.send(
    new GetObjectCommand({
      Bucket: options.assetBucketName ?? getAssetBucketName(),
      Key: key
    })
  );
  const bytes = await result.Body?.transformToByteArray();
  if (!bytes) {
    throw new Error(`Empty S3 object body for key: ${key}`);
  }
  return Buffer.from(bytes);
};
