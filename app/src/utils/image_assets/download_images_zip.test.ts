import { describe, expect, it } from 'vitest';
import {
  buildAiImagesZipFileName,
  download_images_zip_input_schema,
  uniquifyZipFilenames
} from '~/utils/image_assets/download_images_zip';

describe('buildAiImagesZipFileName', () => {
  it('includes path segments when present', () => {
    expect(buildAiImagesZipFileName('ramayanam', [1, 2])).toBe(
      'ramayanam 1:2 (AI Images).zip'
    );
  });

  it('omits empty path', () => {
    expect(buildAiImagesZipFileName('veda', [])).toBe('veda (AI Images).zip');
  });
});

describe('uniquifyZipFilenames', () => {
  it('keeps the first name and suffixes later collisions', () => {
    const out = uniquifyZipFilenames([
      { filename: 'Image Index No. 3 Shloka No. 12.webp', image_id: 1 },
      { filename: 'Image Index No. 3 Shloka No. 12.webp', image_id: 2 },
      { filename: 'Image Index No. 3 Shloka No. 12.webp', image_id: 3 },
      { filename: 'Image Index No. orphan.webp', image_id: 4 }
    ]);
    expect(out.map((f) => f.filename)).toEqual([
      'Image Index No. 3 Shloka No. 12.webp',
      'Image Index No. 3 Shloka No. 12 (2).webp',
      'Image Index No. 3 Shloka No. 12 (3).webp',
      'Image Index No. orphan.webp'
    ]);
    expect(out.map((f) => f.image_id)).toEqual([1, 2, 3, 4]);
  });

  it('adds .webp when missing', () => {
    const out = uniquifyZipFilenames([
      { filename: 'Image Index No. 1', image_id: 9 },
      { filename: 'Image Index No. 1', image_id: 10 }
    ]);
    expect(out.map((f) => f.filename)).toEqual([
      'Image Index No. 1.webp',
      'Image Index No. 1 (2).webp'
    ]);
  });
});

describe('download_images_zip_input_schema', () => {
  it('accepts a valid payload', () => {
    const parsed = download_images_zip_input_schema.parse({
      zip_file_name: 'ramayanam 1:2 (AI Images).zip',
      project_id: 12,
      path_params: [1, 2],
      files: [{ filename: 'Image Index No. 0.webp', image_id: 44 }]
    });
    expect(parsed.files).toHaveLength(1);
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
