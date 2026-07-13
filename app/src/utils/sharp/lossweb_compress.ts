import type { WebpOptions } from 'sharp';

export type CompressedImageResult = {
  buffer: Buffer;
  width: number;
  height: number;
};

const DEFAULT_WEBP_OPTIONS: WebpOptions = {
  // Near-lossless keeps visual fidelity while shrinking PNG/JPEG payloads for S3.
  quality: 87,
  effort: 5,
  nearLossless: true,
  lossless: false,
  smartSubsample: true
};

/**
 * Convert PNG/JPEG/WebP (buffer or base64) to a quality-preserving WebP.
 * Dimensions are preserved (no resize) so gallery aspect ratios stay accurate.
 */
export const compress_to_webp = async (
  input: Buffer | string,
  webp_options?: WebpOptions
): Promise<CompressedImageResult> => {
  const sharpModule = (await import('sharp')).default;
  const input_buffer = typeof input === 'string' ? Buffer.from(input, 'base64') : input;

  const image = sharpModule(input_buffer).rotate();
  const meta = await image.metadata();
  const buffer = await image
    .webp({
      ...DEFAULT_WEBP_OPTIONS,
      ...webp_options
    })
    .toBuffer();

  const out_meta = await sharpModule(buffer).metadata();
  return {
    buffer,
    width: out_meta.width ?? meta.width ?? 0,
    height: out_meta.height ?? meta.height ?? 0
  };
};

/** Convert a WebP buffer/base64 string back to PNG. */
export const webp_to_png = async (input: Buffer | string): Promise<CompressedImageResult> => {
  const sharpModule = (await import('sharp')).default;
  const input_buffer = typeof input === 'string' ? Buffer.from(input, 'base64') : input;

  const image = sharpModule(input_buffer).rotate();
  const meta = await image.metadata();
  const buffer = await image.png({ compressionLevel: 9 }).toBuffer();
  const out_meta = await sharpModule(buffer).metadata();

  return {
    buffer,
    width: out_meta.width ?? meta.width ?? 0,
    height: out_meta.height ?? meta.height ?? 0
  };
};
