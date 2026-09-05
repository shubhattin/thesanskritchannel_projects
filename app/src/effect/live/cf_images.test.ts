import { describe, expect, it } from 'vitest';
import { readImageDimensions } from './cf_images';

const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
);

/** Minimal JPEG: SOI + APP0 + SOF0 declaring 3x2, then EOI. */
const JPEG_3X2 = Buffer.from([
  0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01, 0x01, 0x00, 0x00, 0x01,
  0x00, 0x01, 0x00, 0x00, 0xff, 0xc0, 0x00, 0x0b, 0x08, 0x00, 0x02, 0x00, 0x03, 0x01, 0x01, 0x11,
  0x00, 0xff, 0xd9
]);

/** Minimal VP8X WebP header declaring 5x7 (canvas-1 stored LE). */
const WEBP_5X7 = Buffer.from([
  0x52, 0x49, 0x46, 0x46, 0x1c, 0x00, 0x00, 0x00, 0x57, 0x45, 0x42, 0x50, 0x56, 0x50, 0x38, 0x58,
  0x0a, 0x00, 0x00, 0x00, 0x10, 0x00, 0x00, 0x00, 0x04, 0x00, 0x00, 0x06, 0x00, 0x00
]);

describe('readImageDimensions (CF Images live helper)', () => {
  it('reads PNG dimensions', () => {
    expect(readImageDimensions(PNG_1X1)).toEqual({ width: 1, height: 1 });
  });

  it('reads JPEG dimensions from SOF', () => {
    expect(readImageDimensions(JPEG_3X2)).toEqual({ width: 3, height: 2 });
  });

  it('reads WebP VP8X dimensions', () => {
    expect(readImageDimensions(WEBP_5X7)).toEqual({ width: 5, height: 7 });
  });

  it('returns null for unknown bytes', () => {
    expect(readImageDimensions(Buffer.from([1, 2, 3, 4]))).toBeNull();
    expect(readImageDimensions(Buffer.from('not an image'))).toBeNull();
  });
});
