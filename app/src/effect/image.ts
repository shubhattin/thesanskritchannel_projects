import { Context, Effect, Layer } from 'effect';
import type { WebpOptions } from 'sharp';
import { compress_to_webp, webp_to_png } from '~/utils/sharp/lossweb_compress';
import { ImageProcessingError } from './errors';

export type CompressedImageResult = {
  buffer: Buffer;
  width: number;
  height: number;
};

export class ImageProcessor extends Context.Service<
  ImageProcessor,
  {
    readonly compressToWebp: (
      input: Buffer | string,
      webp_options?: WebpOptions
    ) => Effect.Effect<CompressedImageResult, ImageProcessingError>;
    readonly webpToPng: (
      input: Buffer | string
    ) => Effect.Effect<CompressedImageResult, ImageProcessingError>;
  }
>()('ImageProcessor') {
  static readonly Live = Layer.succeed(ImageProcessor)({
    compressToWebp: (input, webp_options) =>
      Effect.tryPromise({
        try: () => compress_to_webp(input, webp_options),
        catch: (cause) => ImageProcessingError.make({ operation: 'compressToWebp', cause })
      }).pipe(Effect.annotateLogs({ category: 'image', operation: 'compressToWebp' })),

    webpToPng: (input) =>
      Effect.tryPromise({
        try: () => webp_to_png(input),
        catch: (cause) => ImageProcessingError.make({ operation: 'webpToPng', cause })
      }).pipe(Effect.annotateLogs({ category: 'image', operation: 'webpToPng' }))
  });
}
