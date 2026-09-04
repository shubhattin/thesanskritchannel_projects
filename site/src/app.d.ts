// See https://svelte.dev/docs/kit/types#app.d.ts
declare global {
  namespace App {
    // interface Error {}
    // interface Locals {}
    interface PageData {
      lang_id: number;
      script_id: number;
    }
    // interface PageState {}
    // interface Platform {}
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
