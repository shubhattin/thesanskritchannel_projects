import { describe, expect, it } from 'vitest';
import {
  buildAiImagesZipFileName,
  download_images_zip_input_schema,
  uniquifyZipFilenames
} from '~/utils/image_assets/download_images_zip';

describe('buildAiImagesZipFileName', () => {
  it('includes path segments when present', () => {
    expect(buildAiImagesZipFileName('ramayanam', [1, 2])).toBe('ramayanam 1:2 (AI Images).zip');
  });

  it('omits empty path', () => {
    expect(buildAiImagesZipFileName('veda', [])).toBe('veda (AI Images).zip');
  });
});

describe('uniquifyZipFilenames', () => {
  it('defaults to png and suffixes collisions', () => {
    const out = uniquifyZipFilenames([
      { filename: 'Image Index No. 3 Shloka No. 12', image_id: 1 },
      { filename: 'Image Index No. 3 Shloka No. 12.png', image_id: 2 },
      { filename: 'Image Index No. 3 Shloka No. 12.webp', image_id: 3 },
      { filename: 'Image Index No. orphan', image_id: 4 }
    ]);
    expect(out.map((f) => f.filename)).toEqual([
      'Image Index No. 3 Shloka No. 12.png',
      'Image Index No. 3 Shloka No. 12 (2).png',
      'Image Index No. 3 Shloka No. 12 (3).png',
      'Image Index No. orphan.png'
    ]);
    expect(out.map((f) => f.image_id)).toEqual([1, 2, 3, 4]);
  });

  it('uses webp when requested', () => {
    const out = uniquifyZipFilenames(
      [
        { filename: 'Image Index No. 1', image_id: 9 },
        { filename: 'Image Index No. 1', image_id: 10 }
      ],
      'webp'
    );
    expect(out.map((f) => f.filename)).toEqual([
      'Image Index No. 1.webp',
      'Image Index No. 1 (2).webp'
    ]);
  });

  it('avoids collisions when a later basename matches an earlier suffix', () => {
    const out = uniquifyZipFilenames(
      [
        { filename: 'foo', image_id: 1 },
        { filename: 'foo', image_id: 2 },
        { filename: 'foo (2)', image_id: 3 }
      ],
      'png'
    );
    const names = out.map((f) => f.filename);
    expect(names).toEqual(['foo.png', 'foo (2).png', 'foo (2) (2).png']);
    expect(new Set(names).size).toBe(names.length);
  });
});

describe('download_images_zip_input_schema', () => {
  it('defaults format to png', () => {
    const parsed = download_images_zip_input_schema.parse({
      zip_file_name: 'ramayanam 1:2 (AI Images).zip',
      project_id: 12,
      path_params: [1, 2],
      files: [{ filename: 'Image Index No. 0.png', image_id: 44 }]
    });
    expect(parsed.format).toBe('png');
  });

  it('accepts webp format', () => {
    const parsed = download_images_zip_input_schema.parse({
      zip_file_name: 'ramayanam 1:2 (AI Images).zip',
      project_id: 12,
      path_params: [1, 2],
      format: 'webp',
      files: [{ filename: 'Image Index No. 0.webp', image_id: 44 }]
    });
    expect(parsed.format).toBe('webp');
  });

  it('rejects path separators in filenames', () => {
    const result = download_images_zip_input_schema.safeParse({
      zip_file_name: 'ramayanam 1:2 (AI Images).zip',
      project_id: 12,
      path_params: [1, 2],
      files: [{ filename: '../evil.webp', image_id: 44 }]
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty files array', () => {
    const result = download_images_zip_input_schema.safeParse({
      zip_file_name: 'ramayanam (AI Images).zip',
      project_id: 1,
      path_params: [],
      files: []
    });
    expect(result.success).toBe(false);
  });
});
