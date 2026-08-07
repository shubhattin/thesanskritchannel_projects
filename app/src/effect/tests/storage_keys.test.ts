import { describe, expect, it } from 'vitest';
import { buildImageAssetS3Key, isValidImageAssetS3Key } from '~/utils/s3/image_asset_key';

describe('image asset S3 key validation', () => {
  it('builds and accepts valid flat image asset keys', () => {
    const key = buildImageAssetS3Key(12, [1, 2, 3], 4, '11111111-1111-1111-1111-111111111111');
    expect(isValidImageAssetS3Key(key)).toBe(true);
    expect(key.endsWith('.webp')).toBe(true);
  });

  it('rejects path traversal and non-webp keys', () => {
    expect(isValidImageAssetS3Key('../etc/passwd.webp')).toBe(false);
    expect(isValidImageAssetS3Key('other/folder/image_assets/x.webp')).toBe(false);
    expect(
      isValidImageAssetS3Key(
        buildImageAssetS3Key(1, [0], null, '11111111-1111-1111-1111-111111111111').replace(
          '.webp',
          '.png'
        )
      )
    ).toBe(false);
  });
});
