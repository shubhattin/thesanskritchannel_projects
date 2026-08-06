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

const download_blob = (blob: Blob, file_name: string) => {
  const blob_url = URL.createObjectURL(blob);
  download_file_in_browser(blob_url, file_name, true);
};

/**
 * Fetch image bytes via same-origin proxy (avoids CloudFront CORS cache issues).
 * PNG conversion / zipping stay on the client.
 */
export const fetch_image_asset_blob = async (s3_key: string): Promise<Blob> => {
  const res = await fetch_get('/api/download_image_asset', {
    params: { s3_key }
  });
  if (!res.ok) {
    throw new Error((await res.text().catch(() => '')) || `Failed to fetch image (${res.status})`);
  }
  return res.blob();
};

/** Decode WebP (or any browser-decodable image) and re-encode as lossless PNG. */
export const webp_blob_to_png_blob = async (blob: Blob): Promise<Blob> => {
  const bitmap = await createImageBitmap(blob);
  try {
    if (
      typeof OffscreenCanvas !== 'undefined' &&
      typeof OffscreenCanvas.prototype.convertToBlob === 'function'
    ) {
      const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Failed to get canvas context');
      ctx.drawImage(bitmap, 0, 0);
      return await canvas.convertToBlob({ type: 'image/png' });
    }

    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Failed to get canvas context');
    ctx.drawImage(bitmap, 0, 0);
    const png = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!png) throw new Error('Failed to encode PNG');
    return png;
  } finally {
    bitmap.close();
  }
};

/** Force-download a stored WebP via same-origin proxy. */
export const download_s3_webp_in_browser = async (s3_key: string, basename: string) => {
  const blob = await fetch_image_asset_blob(s3_key);
  const file_name = basename.endsWith('.webp') ? basename : `${basename}.webp`;
  download_blob(blob, file_name);
};

/** Download a stored WebP as PNG via proxy fetch + in-browser canvas conversion. */
export const download_webp_as_png_in_browser = async (s3_key: string, basename: string) => {
  const webp = await fetch_image_asset_blob(s3_key);
  const png = await webp_blob_to_png_blob(webp);
  const file_name = basename.endsWith('.png') ? basename : `${basename}.png`;
  download_blob(png, file_name);
};
