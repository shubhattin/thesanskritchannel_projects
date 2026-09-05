/**
 * Type declarations for the `cloudflare:workers` workerd import.
 *
 * `@cloudflare/workers-types` ships its `cloudflare:workers` module types in
 * `index.d.ts`, but TypeScript resolves the package to `index.ts`, so the
 * ambient module is never loaded — declare the bits we use here instead.
 */
declare module 'cloudflare:workers' {
  export function waitUntil(promise: Promise<unknown>): void;
}
