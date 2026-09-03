import { Context, Effect, Layer } from 'effect';

/**
 * Platform-agnostic background work API.
 * Pass a lazy thunk so work is not started until enqueue runs.
 *
 * Live implementations live next to each app runtime:
 * - SvelteKit (Vercel): `src/effect/live/background.ts`
 * - Astro (Cloudflare): `site/src/effect/live/background.ts`
 */
export class BackgroundWork extends Context.Service<
  BackgroundWork,
  {
    readonly enqueue: <A>(work: () => Promise<A>) => Effect.Effect<void>;
  }
>()('BackgroundWork') {
  /** Runs the work inline for tests. */
  static readonly Test = Layer.succeed(BackgroundWork)({
    enqueue: (work) =>
      Effect.promise(() =>
        Promise.resolve()
          .then(work)
          .catch((error) => {
            console.error('[background] work failed', error);
          })
      )
  });
}

export const enqueueBackground = <A>(work: () => Promise<A>) =>
  Effect.gen(function* () {
    const background = yield* BackgroundWork;
    yield* background.enqueue(work);
  });
