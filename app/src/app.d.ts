// See https://svelte.dev/docs/kit/types#app.d.ts
// Env / ExecutionContext / CfProperties come from wrangler-generated
// `worker-configuration.d.ts` (loaded via tsconfig `compilerOptions.types`).
declare global {
  namespace App {
    // interface Error {}
    // interface Locals {}
    // interface PageData {}
    // interface PageState {}
    interface Platform {
      env: Env;
      cf: CfProperties;
      ctx: ExecutionContext;
      caches: CacheStorage & { default: Cache };
    }
  }

  interface Window {
    queryLocalFonts?: () => Promise<{ family: string }[]>;
  }
}

export {};
