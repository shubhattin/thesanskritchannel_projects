import { PUBLIC_AWS_CLOUDFRONT_URL } from '$env/static/public';

/** This is scoped location for this project files in the bucket */
export const PROJECT_S3_ALIAS = '003_admin_portal' as const;

export const SUB_FOLDERS = ['shlOkAni'] as const;

/** CDN URL for the project */
const CLOUDFRONT_URL = PUBLIC_AWS_CLOUDFRONT_URL;

/** Get the CDN URL for a given S3 key */
export const getCDNUrl = (s3_key: string) => {
  return `${CLOUDFRONT_URL ?? ''}/${s3_key}`;
};
