import { Effect, Layer } from 'effect';
import sharp, { type WebpOptions } from 'sharp';
import { ImageProcessor, type CompressedImageResult } from '../image';
import { ImageProcessingError } from '../errors';

const DEFAULT_WEBP_OPTIONS: WebpOptions = {
  // Near-lossless keeps visual fidelity while shrinking PNG/JPEG payloads for S3.
  quality: 87,
  effort: 5,
  nearLossless: true,
  lossless: false,
  smartSubsample: true
};

const toBuffer = (input: Buffer | Uint8Array | string): Buffer => {
  if (Buffer.isBuffer(input)) return input;
  if (input instanceof Uint8Array) return Buffer.from(input);
  return Buffer.from(input, 'base64');
};

/**
 * Node / Vitest ImageProcessor live. Must not be imported from the Worker
 * graph — wrangler cannot bundle sharp's native bindings.
 *
 * Converts PNG/JPEG/WebP to a quality-preserving WebP. Dimensions are
 * preserved (no resize) so gallery aspect ratios stay accurate.
 */
export const ImageProcessorLive = Layer.succeed(ImageProcessor)({
  compressToWebp: (input, webp_options) =>
    Effect.tryPromise({
      try: async (): Promise<CompressedImageResult> => {
        const input_buffer = toBuffer(input);
        const image = sharp(input_buffer).rotate();
        const meta = await image.metadata();
        const buffer = await image
          .webp({
            ...DEFAULT_WEBP_OPTIONS,
            ...webp_options
          })
          .toBuffer();

        const out_meta = await sharp(buffer).metadata();
        return {
          buffer,
          width: out_meta.width ?? meta.width ?? 0,
          height: out_meta.height ?? meta.height ?? 0
        };
      },
      catch: (cause) => ImageProcessingError.make({ operation: 'compressToWebp', cause })
    }).pipe(Effect.annotateLogs({ category: 'image', operation: 'compressToWebp' }))
});
