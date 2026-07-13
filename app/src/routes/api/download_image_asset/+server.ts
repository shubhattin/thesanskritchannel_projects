import { error } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { Readable } from 'node:stream';
import ms from 'ms';
import { protected_admin_route_check } from '~/api/api_init';
import {
  createS3Client,
  getAssetFile,
  isValidImageAssetS3Key
} from '~/utils/s3/upload_file.server';

const filenameFromS3Key = (s3_key: string) => s3_key.split('/').pop() ?? 'image.webp';

export const GET: RequestHandler = async ({ url, request }) => {
  const user = await protected_admin_route_check(request.headers);
  if (!user || user.role !== 'admin') throw error(401, 'UNAUTHORIZED');

  const s3_key = url.searchParams.get('s3_key');
  if (!s3_key) {
    throw error(400, 'Missing "s3_key" query parameter');
  }
  if (!isValidImageAssetS3Key(s3_key)) {
    throw error(400, 'Invalid image asset s3_key');
  }

  const disposition =
    url.searchParams.get('download') === '1' || url.searchParams.get('download') === 'true'
      ? 'attachment'
      : 'inline';
  const filename = filenameFromS3Key(s3_key);

  try {
    const s3Client = createS3Client();
    const webp_buffer = await getAssetFile(s3_key, { s3Client });
    const node_stream = Readable.from(webp_buffer);
    const web_stream = Readable.toWeb(node_stream) as ReadableStream;

    return new Response(web_stream, {
      status: 200,
      headers: {
        'Content-Type': 'image/webp',
        'Content-Length': String(webp_buffer.byteLength),
        'Content-Disposition': `${disposition}; filename="${filename}"`,
        'Cache-Control': `private, max-age=${ms('10mins') / 1000}`
      }
    });
  } catch (err) {
    console.error('download_image_asset failed', err);
    throw error(500, 'Failed to download image asset');
  }
};
