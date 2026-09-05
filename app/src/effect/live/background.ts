import { Effect, Layer } from 'effect';
import { BackgroundWork } from '../background';

/**
 * Admin / Cloudflare Live: `waitUntil` from `cloudflare:workers` keeps the
 * invocation alive after the response is sent (cache warm, QStash follow-ups).
 * @see https://developers.cloudflare.com/changelog/post/2025-08-08-add-waituntil-cloudflare-workers/
 *
 * Imported lazily: SvelteKit loads the server bundle in Node during build-time
 * route analysis, where the `cloudflare:` specifier does not exist — a static
 * import crashes `vite build` (`ERR_UNSUPPORTED_ESM_URL_SCHEME`). The dynamic
 * import is never executed during analysis, resolves on workerd at request
 * time, and falls back to fire-and-forget outside a Worker (local `vite dev`,
 * tests).
 */
export const BackgroundWorkLive = Layer.succeed(BackgroundWork)({
  enqueue: (work) =>
    Effect.sync(() => {
      const promise = Promise.resolve()
        .then(work)
        .catch((error) => {
          console.error('[background] work failed', error);
        });
      import('cloudflare:workers').then(
        ({ waitUntil }) => waitUntil(promise),
        () => {
          void promise;
        }
      );
    })
});
