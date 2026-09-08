import { describe, expect, it } from 'vitest';
import { Effect, Layer } from 'effect';
import { BackgroundWork, enqueueBackground } from '../background';
import { CfEnv } from '../cf_env';

describe('BackgroundWork.Live (CfEnv.waitUntil)', () => {
  it('enqueues work through CfEnv.waitUntil without blocking', async () => {
    const waited: Promise<unknown>[] = [];
    const cfLayer = Layer.succeed(CfEnv)({
      get env(): App.Platform['env'] {
        throw new Error('CfEnv env is unused in this test');
      },
      waitUntil: (promise) => {
        waited.push(promise);
      }
    });

    let ran = false;
    await Effect.runPromise(
      enqueueBackground(async () => {
        ran = true;
      }).pipe(Effect.provide(BackgroundWork.Live), Effect.provide(cfLayer))
    );
    await Promise.all(waited);
    expect(waited).toHaveLength(1);
    expect(ran).toBe(true);
  });
});
