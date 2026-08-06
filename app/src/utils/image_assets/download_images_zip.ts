export type DownloadImagesZipFormat = 'webp' | 'png';

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
