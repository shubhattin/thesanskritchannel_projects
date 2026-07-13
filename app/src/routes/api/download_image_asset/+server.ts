import type { RequestHandler } from './$types';
import { streamImageAssetResponse } from '~/utils/s3/stream_image_asset.server';

const filenameFromS3Key = (s3_key: string) => s3_key.split('/').pop() ?? 'image.webp';

export const GET: RequestHandler = async ({ url, request }) =>
  streamImageAssetResponse({
    request,
    url,
    content_type: 'image/webp',
    filename: filenameFromS3Key,
    error_log_label: 'download_image_asset',
    error_message: 'Failed to download image asset'
  });
