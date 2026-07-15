import { z } from 'zod';

export const download_images_zip_file_schema = z.object({
  filename: z
    .string()
    .min(1)
    .max(240)
    .regex(/^[^/\\]+$/, 'Filename must not contain path separators'),
  image_id: z.int().positive()
});

export const download_images_zip_input_schema = z.object({
  zip_file_name: z
    .string()
    .min(1)
    .max(260)
    .regex(/^[^/\\]+$/, 'Zip file name must not contain path separators'),
  project_id: z.int().positive(),
  path_params: z.array(z.int().positive()),
  files: z.array(download_images_zip_file_schema).min(1).max(500)
});

export type DownloadImagesZipInput = z.infer<typeof download_images_zip_input_schema>;

/** `{project_key} {path} (AI Images).zip` — empty path omits the path segment. */
export const buildAiImagesZipFileName = (project_key: string, path_params: readonly number[]) => {
  const path = path_params.join(':');
  return path
    ? `${project_key} ${path} (AI Images).zip`
    : `${project_key} (AI Images).zip`;
};

/** Ensure `.webp` and disambiguate collisions with ` (2)`, ` (3)`, … */
export const uniquifyZipFilenames = <T extends { filename: string }>(files: readonly T[]): T[] => {
  const seen = new Map<string, number>();
  return files.map((file) => {
    const without_ext = file.filename.replace(/\.webp$/i, '');
    const base_key = `${without_ext}.webp`;
    const count = (seen.get(base_key) ?? 0) + 1;
    seen.set(base_key, count);
    const filename = count === 1 ? base_key : `${without_ext} (${count}).webp`;
    return { ...file, filename };
  });
};
