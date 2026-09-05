import { Effect, Layer } from 'effect';
import { ImageProcessor, type CompressedImageResult } from '../image';
import { ImageProcessingError } from '../errors';

const DEFAULT_QUALITY = 87;

/** PNG signature bytes. */
const PNG_SIG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] as const;

/** JPEG SOF markers that carry dimensions (excludes DHT/DAC/JPG markers). */
const JPEG_SOF = new Set([
  0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf
]);

const readU16BE = (bytes: Uint8Array, offset: number): number =>
  bytes[offset]! * 256 + bytes[offset + 1]!;

const readU16LE = (bytes: Uint8Array, offset: number): number =>
  bytes[offset]! + bytes[offset + 1]! * 256;

const readU24LE = (bytes: Uint8Array, offset: number): number =>
  bytes[offset]! + bytes[offset + 1]! * 256 + bytes[offset + 2]! * 65536;

const readU32BE = (bytes: Uint8Array, offset: number): number =>
  bytes[offset]! * 16777216 + bytes[offset + 1]! * 65536 + readU16BE(bytes, offset + 2);

const startsWith = (bytes: Uint8Array, offset: number, text: string): boolean => {
  for (let index = 0; index < text.length; index += 1) {
    if (bytes[offset + index] !== text.charCodeAt(index)) return false;
  }
  return true;
};

/** PNG: 8-byte signature, then IHDR with 4-byte BE width/height at 16/20. */
const readPngDimensions = (bytes: Uint8Array): { width: number; height: number } | null => {
  if (bytes.length < 24 || !PNG_SIG.every((byte, index) => bytes[index] === byte)) return null;
  if (!startsWith(bytes, 12, 'IHDR')) return null;
  return { width: readU32BE(bytes, 16), height: readU32BE(bytes, 20) };
};

/** JPEG: SOI, then scan segments for a SOF marker (dims precede SOS data). */
const readJpegDimensions = (bytes: Uint8Array): { width: number; height: number } | null => {
  if (bytes.length <= 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  let offset = 2;
  while (offset + 9 < bytes.length) {
    if (bytes[offset] !== 0xff) return null;
    const marker = bytes[offset + 1]!;
    if (marker === 0xd9 || marker === 0xda) return null;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8)) {
      offset += 2;
      continue;
    }
    const length = readU16BE(bytes, offset + 2);
    if (length < 2) return null;
    if (JPEG_SOF.has(marker)) {
      return { width: readU16BE(bytes, offset + 7), height: readU16BE(bytes, offset + 5) };
    }
    offset += 2 + length;
  }
  return null;
};

/** WebP: RIFF....WEBP + VP8 / VP8L / VP8X chunk. */
const readWebpDimensions = (bytes: Uint8Array): { width: number; height: number } | null => {
  if (bytes.length < 30 || !startsWith(bytes, 0, 'RIFF') || !startsWith(bytes, 8, 'WEBP')) {
    return null;
  }
  // Lossy: 3-byte frame tag + 0x9d012a start code, then 14-bit LE dims.
  if (startsWith(bytes, 12, 'VP8 ')) {
    if (bytes[23] !== 0x9d || bytes[24] !== 0x01 || bytes[25] !== 0x2a) return null;
    return { width: readU16LE(bytes, 26) & 0x3fff, height: readU16LE(bytes, 28) & 0x3fff };
  }
  // Lossless: 0x2f signature + packed 14-bit (width-1)/(height-1).
  if (startsWith(bytes, 12, 'VP8L')) {
    if (bytes[20] !== 0x2f) return null;
    const bits = readU16LE(bytes, 21) + readU16LE(bytes, 23) * 65536;
    return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
  }
  // Extended: 24-bit LE (canvas-1) at offsets 24/27.
  if (startsWith(bytes, 12, 'VP8X')) {
    return { width: readU24LE(bytes, 24) + 1, height: readU24LE(bytes, 27) + 1 };
  }
  return null;
};

/**
 * Pure-JS image dimensions (PNG / JPEG / WebP) — Cloudflare Images converts
 * but never reports metadata, and `sharp` cannot run on workerd.
 */
export const readImageDimensions = (bytes: Uint8Array): { width: number; height: number } | null =>
  readPngDimensions(bytes) ?? readJpegDimensions(bytes) ?? readWebpDimensions(bytes);

const toBytes = (input: Buffer | Uint8Array | string): Uint8Array => {
  // Copy off Node Buffer — CF Images can reject Buffer-backed stream chunks.
  if (Buffer.isBuffer(input)) return Uint8Array.from(input);
  if (input instanceof Uint8Array) return Uint8Array.from(input);
  return Buffer.from(input, 'base64');
};

/**
 * Workers ImageProcessor live via the `IMAGES` binding
 * (see `wrangler.toml [images]`).
 *
 * Sharp mapping: dimensions are preserved via a same-size `scale-down`
 * transform (never upscales); only `quality` is honoured (default 87),
 * encoder-only knobs (`effort`, `nearLossless`, …) have no Images equivalent
 * and output is always lossy WebP.
 */
export const ImageProcessorLive = Layer.succeed(ImageProcessor)({
  compressToWebp: (input, webp_options) =>
    Effect.tryPromise({
      try: async (): Promise<CompressedImageResult> => {
        const bytes = toBytes(input);
        const dims = readImageDimensions(bytes);
        if (!dims || !dims.width || !dims.height) {
          throw new Error('Unsupported image or missing dimensions (expected PNG/JPEG/WebP)');
        }
        const { env } = await import('cloudflare:workers');
        const stream = new ReadableStream<Uint8Array>({
          start(controller) {
            controller.enqueue(bytes);
            controller.close();
          }
        });
        const output = await env.IMAGES.input(stream)
          .transform({ width: dims.width, height: dims.height, fit: 'scale-down' })
          .output({
            format: 'image/webp',
            quality: webp_options?.quality ?? DEFAULT_QUALITY
          });
        const response = output.response();
        if (!response.ok) {
          throw new Error(
            `CF Images output ${response.status}: ${(await response.text()).slice(0, 500)}`
          );
        }
        return {
          buffer: Buffer.from(await response.arrayBuffer()),
          width: dims.width,
          height: dims.height
        };
      },
      catch: (cause) => ImageProcessingError.make({ operation: 'compressToWebp', cause })
    }).pipe(Effect.annotateLogs({ category: 'image', operation: 'compressToWebp' }))
});
