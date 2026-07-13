import type { RequestHandler } from './$types';
import { webp_to_png } from '~/utils/sharp/lossweb_compress';
import { streamImageAssetResponse } from '~/utils/s3/stream_image_asset.server';

const filenameFromS3Key = (s3_key: string) => {
  const base = s3_key.split('/').pop() ?? 'image.webp';
  return base.replace(/\.webp$/i, '.png');
};

export const GET: RequestHandler = async ({ url, request }) =>
  streamImageAssetResponse({
    request,
    url,
    content_type: 'image/png',
    filename: filenameFromS3Key,
    transform: async (webp) => (await webp_to_png(webp)).buffer,
    error_log_label: 'convert_webp_to_png',
    error_message: 'Failed to convert WebP to PNG'
  });
