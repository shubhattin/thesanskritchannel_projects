import { Effect, Layer } from 'effect';
import { waitUntil } from '@vercel/functions';
import { BackgroundWork } from '../background';

/**
 * Admin / SvelteKit Live: Vercel `waitUntil` keeps the invocation alive after
 * the response is sent (same semantics as Cloudflare's waitUntil).
 */
export const BackgroundWorkLive = Layer.succeed(BackgroundWork)({
  enqueue: (work) =>
    Effect.sync(() => {
      waitUntil(
        Promise.resolve()
          .then(work)
          .catch((error) => {
            console.error('[background] work failed', error);
          })
      );
    })
});
