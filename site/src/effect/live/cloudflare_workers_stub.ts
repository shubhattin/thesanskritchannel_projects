/** Vitest-only stand-in for `cloudflare:workers` (see vitest.config.ts alias). */
export function waitUntil(promise: Promise<unknown>): void {
  void promise;
}
