/**
 * Type declarations for the `cloudflare:workers` workerd import.
 *
 * `@cloudflare/workers-types` ships its `cloudflare:workers` module types in
 * `index.d.ts`, but TypeScript resolves the package to `index.ts`, so the
 * ambient module is never loaded — declare the bits we use here instead.
 * Lives here (not in `effect/`) so `wrangler types` output stays untouched.
 */
type ImagesBindingTransformOutput = {
  response(): Response;
};

type ImagesBindingTransform = {
  output(options: { format: 'image/webp'; quality?: number }): ImagesBindingTransformOutput;
};

type ImagesBindingTransformer = {
  transform(options: {
    width?: number;
    height?: number;
    fit?: 'scale-down' | 'contain' | 'cover' | 'crop' | 'pad';
    gravity?: string;
  }): ImagesBindingTransform;
};

type ImagesBinding = {
  input(stream: ReadableStream<Uint8Array>): ImagesBindingTransformer;
};

declare module 'cloudflare:workers' {
  export function waitUntil(promise: Promise<unknown>): void;
  export const env: {
    IMAGES: ImagesBinding;
  };
}
