import JSZip from 'jszip';
import {
  get_image_asset_presigned_urls,
  webp_blob_to_png_blob
} from '~/tools/download_file_browser';
import type { DownloadImagesZipFormat } from '~/utils/image_assets/download_images_zip';

export type ZipImageFile = {
  s3_key: string;
  filename: string;
};

export type BuildImagesZipProgress = {
  done: number;
  total: number;
  phase: 'downloading' | 'zipping';
};

type BuildImagesZipOptions = {
  files: readonly ZipImageFile[];
  format: DownloadImagesZipFormat;
  onProgress?: (progress: BuildImagesZipProgress) => void;
};

/** Presign once, fetch images from S3 in parallel, optionally convert to PNG, build STORE zip. */
export const build_images_zip_client = async ({
  files,
  format,
  onProgress
}: BuildImagesZipOptions): Promise<Blob> => {
  const total = files.length;
  if (total === 0) throw new Error('No images selected');

  let done = 0;
  onProgress?.({ done, total, phase: 'downloading' });

  const urls = await get_image_asset_presigned_urls(files.map((f) => f.s3_key));

  const zip = new JSZip();
  const concurrency = Math.min(4, total);
  let next = 0;

  const worker = async () => {
    while (next < total) {
      const i = next++;
      const file = files[i]!;
      const url = urls[file.s3_key];
      if (!url) throw new Error(`Missing presigned URL for ${file.s3_key}`);
      const res = await fetch(url);
      if (!res.ok) {
        throw new Error(
          (await res.text().catch(() => '')) || `Failed to fetch image (${res.status})`
        );
      }
      let blob = await res.blob();
      if (format === 'png') blob = await webp_blob_to_png_blob(blob);
      zip.file(file.filename, blob, { compression: 'STORE' });
      done += 1;
      onProgress?.({ done, total, phase: 'downloading' });
    }
  };

  await Promise.all(Array.from({ length: concurrency }, () => worker()));

  onProgress?.({ done: total, total, phase: 'zipping' });
  return zip.generateAsync({ type: 'blob', compression: 'STORE' });
};
