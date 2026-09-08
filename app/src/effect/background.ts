import { Context, Effect, Layer } from 'effect';
import { CfEnv } from './cf_env';

/**
 * Platform-agnostic background work API.
 * Pass a lazy thunk so work is not started until enqueue runs.
 *
 * Live uses `CfEnv.waitUntil` from SvelteKit `event.platform` so the same
 * path runs in `vite dev` (adapter proxy) and on workerd.
 */
export class BackgroundWork extends Context.Service<
  BackgroundWork,
  {
    readonly enqueue: <A>(work: () => Promise<A>) => Effect.Effect<void>;
  }
>()('BackgroundWork') {
  static readonly Live = Layer.effect(BackgroundWork)(
    Effect.gen(function* () {
      const cf = yield* CfEnv;
      return {
        enqueue: <A>(work: () => Promise<A>) =>
          Effect.sync(() => {
            const promise = Promise.resolve()
              .then(work)
              .catch((error) => {
                console.error('[background] work failed', error);
              });
            cf.waitUntil(promise);
          })
      };
    })
  );

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
