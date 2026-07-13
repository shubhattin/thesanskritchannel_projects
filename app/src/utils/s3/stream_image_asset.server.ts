import { error } from '@sveltejs/kit';
import { Readable } from 'node:stream';
import ms from 'ms';
import { protected_admin_route_check } from '~/api/api_init';
import {
  createS3Client,
  getAssetFile,
  isValidImageAssetS3Key
} from '~/utils/s3/upload_file.server';

type StreamImageAssetOptions = {
  request: Request;
  url: URL;
  content_type: string;
  filename: (s3_key: string) => string;
  transform?: (webp: Buffer) => Promise<Buffer>;
  error_log_label: string;
  error_message: string;
};

/** Shared admin auth + S3 fetch + streamed image response for asset download routes. */
export const streamImageAssetResponse = async ({
  request,
  url,
  content_type,
  filename,
  transform,
  error_log_label,
  error_message
}: StreamImageAssetOptions) => {
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

  try {
    const s3Client = createS3Client();
    const webp_buffer = await getAssetFile(s3_key, { s3Client });
    const body = transform ? await transform(webp_buffer) : webp_buffer;
    const web_stream = Readable.toWeb(Readable.from(body)) as ReadableStream;

    return new Response(web_stream, {
      status: 200,
      headers: {
        'Content-Type': content_type,
        'Content-Length': String(body.byteLength),
        'Content-Disposition': `${disposition}; filename="${filename(s3_key)}"`,
        'Cache-Control': `private, max-age=${ms('10mins') / 1000}`
      }
    });
  } catch (err) {
    console.error(`${error_log_label} failed`, err);
    throw error(500, error_message);
  }
};
