import { Context, Effect } from 'effect';
import type { WebpOptions } from 'sharp';
import { ImageProcessingError } from './errors';

export type CompressedImageResult = {
  buffer: Buffer;
  width: number;
  height: number;
};

/**
 * Platform-agnostic image processing API.
 *
 * Live implementations live in `src/effect/live/`:
 * - Node / Vitest (`sharp`): `live/sharp_images.ts` — never import from the
 *   Worker graph, wrangler cannot bundle sharp's native bindings.
 * - Cloudflare Workers (Images binding): `live/cf_images.ts`.
 *
 * Only `compressToWebp` has callers (`persistImageAsset`). Both lives return
 * real dimensions — persist fails the upload when they are missing.
 */
export class ImageProcessor extends Context.Service<
  ImageProcessor,
  {
    readonly compressToWebp: (
      input: Buffer | Uint8Array | string,
      webp_options?: WebpOptions
    ) => Effect.Effect<CompressedImageResult, ImageProcessingError>;
  }
>()('ImageProcessor') {}
