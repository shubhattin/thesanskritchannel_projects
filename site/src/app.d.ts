// See https://svelte.dev/docs/kit/types#app.d.ts
// Env / ExecutionContext / CfProperties come from wrangler-generated
// `worker-configuration.d.ts` (loaded via tsconfig `compilerOptions.types`).
declare global {
  namespace App {
    // interface Error {}
    // interface Locals {}
    interface PageData {
      lang_id: number;
      script_id: number;
    }
    // interface PageState {}
    interface Platform {
      env: Env;
      cf: CfProperties;
      ctx: ExecutionContext;
      caches: CacheStorage & { default: Cache };
    }
  }

  // View Transitions API (Chromium; progressive enhancement elsewhere).
  // https://svelte.dev/blog/view-transitions
  interface ViewTransition {
    updateCallbackDone: Promise<void>;
    ready: Promise<void>;
    finished: Promise<void>;
    skipTransition: () => void;
  }

  interface Document {
    startViewTransition?(updateCallback: () => Promise<void> | void): ViewTransition;
  }
}

export {};
