import { z } from 'zod';

export const download_images_zip_format_schema = z.enum(['webp', 'png']);
export type DownloadImagesZipFormat = z.infer<typeof download_images_zip_format_schema>;

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
  format: download_images_zip_format_schema.default('png'),
  files: z.array(download_images_zip_file_schema).min(1).max(500)
});

export type DownloadImagesZipInput = z.infer<typeof download_images_zip_input_schema>;

/** `{project_key} {path} (AI Images).zip` — empty path omits the path segment. */
export const buildAiImagesZipFileName = (project_key: string, path_params: readonly number[]) => {
  const path = path_params.join(':');
  return path ? `${project_key} ${path} (AI Images).zip` : `${project_key} (AI Images).zip`;
};

/**
 * Normalize to the requested extension and disambiguate collisions with ` (2)`, ` (3)`, …
 * Reserves each emitted name so inputs like `foo`, `foo`, `foo (2)` stay unique.
 */
export const uniquifyZipFilenames = <T extends { filename: string }>(
  files: readonly T[],
  format: DownloadImagesZipFormat = 'png'
): T[] => {
  const ext = `.${format}`;
  const used = new Set<string>();
  return files.map((file) => {
    const without_ext = file.filename.replace(/\.(webp|png)$/i, '');
    let candidate = `${without_ext}${ext}`;
    let n = 1;
    while (used.has(candidate)) {
      n += 1;
      candidate = `${without_ext} (${n})${ext}`;
    }
    used.add(candidate);
    return { ...file, filename: candidate };
  });
};
