import { fetch_get } from './fetch';

export const download_file_in_browser = (
  link: string,
  name: string,
  revoke_url_after_download = false
) => {
  const a = document.createElement('a');
  a.href = link;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  if (revoke_url_after_download) URL.revokeObjectURL(link);
};

/** `Image Index No. {index} [Shloka No. {n}]` — used as the download basename (no extension). */
export const buildImageAssetDownloadBasename = (
  index: number | null,
  shloka_num?: number | null
) => {
  const index_part = index === null ? 'orphan' : String(index);
  if (shloka_num != null) {
    return `Image Index No. ${index_part} Shloka No. ${shloka_num}`;
  }
  return `Image Index No. ${index_part}`;
};

const download_blob_response = async (req: Response, file_name: string) => {
  if (!req.ok) {
    throw new Error((await req.text().catch(() => '')) || 'Download failed');
  }
  const blob = await req.blob();
  const blob_url = window.URL.createObjectURL(blob);
  download_file_in_browser(blob_url, file_name, true);
};

/** Force-download stored WebP via same-origin proxy (CDN URLs ignore the download attribute). */
export const download_s3_webp_in_browser = async (s3_key: string, basename: string) => {
  const req = await fetch_get('/api/download_image_asset', {
    params: {
      s3_key,
      download: '1'
    }
  });
  const file_name = basename.endsWith('.webp') ? basename : `${basename}.webp`;
  await download_blob_response(req, file_name);
};

/** Download a stored WebP asset as PNG via the admin conversion route. */
export const download_webp_as_png_in_browser = async (s3_key: string, basename: string) => {
  const req = await fetch_get('/api/convert_webp_to_png', {
    params: {
      s3_key,
      download: '1'
    }
  });
  const file_name = basename.endsWith('.png') ? basename : `${basename}.png`;
  await download_blob_response(req, file_name);
};
