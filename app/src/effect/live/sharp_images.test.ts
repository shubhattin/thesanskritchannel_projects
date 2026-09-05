import { describe, expect, it } from 'vitest';
import { Effect } from 'effect';
import { ImageProcessor } from '../image';
import { ImageProcessorLive } from './sharp_images';

const PNG_1X1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
  'base64'
);

describe('ImageProcessorLive (sharp)', () => {
  it('compresses to webp and reports dimensions', async () => {
    const result = await Effect.runPromise(
      Effect.gen(function* () {
        const images = yield* ImageProcessor;
        return yield* images.compressToWebp(PNG_1X1);
      }).pipe(Effect.provide(ImageProcessorLive))
    );

    expect(result.buffer.subarray(0, 4).toString()).toBe('RIFF');
    expect(result.buffer.subarray(8, 12).toString()).toBe('WEBP');
    expect(result.width).toBe(1);
    expect(result.height).toBe(1);
  });
});
