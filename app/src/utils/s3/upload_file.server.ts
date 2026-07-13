import { z } from 'zod';
import mime from 'mime-types';
import type { PutObjectCommandInput } from '@aws-sdk/client-s3';
import { DeleteObjectCommand, PutObjectCommand, S3Client, StorageClass } from '@aws-sdk/client-s3';
import { randomUUID } from 'node:crypto';
import { SUB_FOLDERS, PROJECT_S3_ALIAS } from '~/constants';
import { env } from '$env/dynamic/private';

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

export type ImageAssetS3Key =
  `${typeof PROJECT_S3_ALIAS}/${(typeof SUB_FOLDERS)[number]}/image_assets/${string}.webp`;

/** Flat key — no project/path/index subfolders. */
export const buildImageAssetS3Key = (
  project_id: number,
  path_params: readonly number[],
  index: number | null,
  uuid: string = randomUUID()
): ImageAssetS3Key => {
  const path_part = path_params.join('-');
  const index_part = index === null ? 'orphan' : String(index);
  const file_name = `${project_id}:${path_part}:${index_part}:${uuid}`;
  return `003_projects_portal/shlOkAni_texts/image_assets/${file_name}.webp`;
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

/** Allows digits, letters, `_`, `.`, `-`, and `:` in the flat filename. */
const ASSET_KEY_PATTERN = new RegExp(
  `^${PROJECT_S3_ALIAS}/(?:${SUB_FOLDERS.join('|')})/image_assets/[\\w.:-]+\\.webp$`
);

export const isValidImageAssetS3Key = (key: string): key is ImageAssetS3Key =>
  ASSET_KEY_PATTERN.test(key);

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
