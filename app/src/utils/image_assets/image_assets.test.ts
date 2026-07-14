import { describe, expect, it } from 'vitest';
import { get_non_square_aspect_ratio_label } from '~/utils/image_assets/aspect_ratio';
import { buildImageAssetS3Key, isValidImageAssetS3Key } from '~/utils/s3/image_asset_key';
import {
  getShlokaImageBatchCustomId,
  isShlokaImageBatchCustomId,
  parseShlokaImageBatchCustomId
} from '~/utils/ai_batch/batch_custom_id';
import {
  buildOldToNewTextIndexMap,
  remapBatchMetadataIndex,
  remapTextImageJoinIndexes
} from '~/utils/text/row_edit.server';
import { PROJECT_S3_ALIAS, SUB_FOLDERS } from '~/constants';

describe('aspect ratio labels', () => {
  it('returns null for square images', () => {
    expect(get_non_square_aspect_ratio_label(1024, 1024)).toBeNull();
  });

  it('reduces non-square ratios', () => {
    expect(get_non_square_aspect_ratio_label(1536, 1024)).toBe('3:2');
    expect(get_non_square_aspect_ratio_label(1024, 1536)).toBe('2:3');
  });
});

describe('S3 image asset keys', () => {
  it('builds flat keys without subfolders', () => {
    const key = buildImageAssetS3Key(12, [2, 5], 3, 'abcd-uuid');
    expect(key).toBe(`${PROJECT_S3_ALIAS}/${SUB_FOLDERS[0]}/image_assets/12:2-5:3:abcd-uuid.webp`);
    expect(isValidImageAssetS3Key(key)).toBe(true);
  });

  it('supports orphan index segment', () => {
    const key = buildImageAssetS3Key(1, [], null, 'u1');
    expect(key).toBe(`${PROJECT_S3_ALIAS}/${SUB_FOLDERS[0]}/image_assets/1::orphan:u1.webp`);
    expect(isValidImageAssetS3Key(key)).toBe(true);
  });
});

describe('shloka batch custom ids', () => {
  it('encodes project/path/index with a unique 4-char suffix', () => {
    const a = getShlokaImageBatchCustomId(12, [2, 5], 3);
    const b = getShlokaImageBatchCustomId(12, [2, 5], 3);
    expect(a).not.toBe(b);
    expect(isShlokaImageBatchCustomId(a)).toBe(true);
    expect(a).toMatch(/^shloka-image:12-2\/5-3-[A-Za-z0-9]{4}$/);

    const parsed = parseShlokaImageBatchCustomId(a);
    expect(parsed).toMatchObject({
      project_id: 12,
      path_params: [2, 5],
      index: 3
    });
    expect(parsed?.suffix).toHaveLength(4);
  });

  it('parses empty path segments', () => {
    const id = getShlokaImageBatchCustomId(1, [], 0);
    expect(parseShlokaImageBatchCustomId(id)).toMatchObject({
      project_id: 1,
      path_params: [],
      index: 0
    });
  });

  it('preserves null path segments distinctly from 0', () => {
    const id = getShlokaImageBatchCustomId(9, [1, null, 0], 2);
    expect(id).toMatch(/^shloka-image:9-1\/_\/0-2-[A-Za-z0-9]{4}$/);
    expect(parseShlokaImageBatchCustomId(id)).toMatchObject({
      project_id: 9,
      path_params: [1, null, 0],
      index: 2
    });
  });
});

describe('text image index remapping', () => {
  it('remaps retained indexes and orphans deleted ones', () => {
    const old_to_new = buildOldToNewTextIndexMap([
      { source_index: 1, text: 'b', shloka_type: true },
      { source_index: 0, text: 'a', shloka_type: true }
    ]);
    expect(old_to_new.get(0)).toBe(1);
    expect(old_to_new.get(1)).toBe(0);

    const remapped = remapTextImageJoinIndexes(
      [
        { id: 1, index: 0 },
        { id: 2, index: 2 },
        { id: 3, index: null }
      ],
      old_to_new
    );
    expect(remapped).toEqual([
      { id: 1, index: 1 },
      { id: 2, index: null },
      { id: 3, index: null }
    ]);

    expect(remapBatchMetadataIndex(0, old_to_new)).toBe(1);
    expect(remapBatchMetadataIndex(2, old_to_new)).toBeNull();
  });
});
