import { PUBLIC_AWS_CLOUDFRONT_URL } from '$env/static/public';

/** CDN URL for the project */
const CLOUDFRONT_URL = PUBLIC_AWS_CLOUDFRONT_URL;

/** Get the CDN URL for a given S3 key */
export const getCDNUrl = (s3_key: string) => {
  return `${CLOUDFRONT_URL ?? ''}/${s3_key}`;
};
