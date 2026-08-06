import JSZip from 'jszip';
import { fetch_image_asset_blob, webp_blob_to_png_blob } from '~/tools/download_file_browser';
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

/** Fetch images via same-origin proxy in parallel, optionally convert to PNG, build STORE zip. */
export const build_images_zip_client = async ({
  files,
  format,
  onProgress
}: BuildImagesZipOptions): Promise<Blob> => {
  const total = files.length;
  if (total === 0) throw new Error('No images selected');

  let done = 0;
  onProgress?.({ done, total, phase: 'downloading' });

  const zip = new JSZip();
  await Promise.all(
    files.map(async (file) => {
      let blob = await fetch_image_asset_blob(file.s3_key);
      if (format === 'png') blob = await webp_blob_to_png_blob(blob);
      zip.file(file.filename, blob, { compression: 'STORE' });
      done += 1;
      onProgress?.({ done, total, phase: 'downloading' });
    })
  );

  onProgress?.({ done: total, total, phase: 'zipping' });
  return zip.generateAsync({ type: 'blob', compression: 'STORE' });
};
