import { afterEach, describe, expect, it } from 'vitest';
import { Effect } from 'effect';
import { BackgroundWork, enqueueBackground } from '../background';

/**
 * Drives the real `@vercel/functions` waitUntil through a faithful request
 * scope (the same `Symbol.for('@vercel/request-context')` slot the Vercel
 * runtime populates — see get-context.js in @vercel/functions). No module
 * mocking: only the runtime-provided scope is faked.
 */
const REQUEST_CONTEXT = Symbol.for('@vercel/request-context');

const setRequestScope = (waitUntil: (promise: Promise<unknown>) => void): void => {
  Reflect.set(globalThis, REQUEST_CONTEXT, {
    get: () => ({ waitUntil })
  });
};

describe('BackgroundWork.Live (Vercel waitUntil)', () => {
  afterEach(() => {
    Reflect.deleteProperty(globalThis, REQUEST_CONTEXT);
  });

  it('enqueues work through waitUntil without blocking', async () => {
    const waited: Promise<unknown>[] = [];
    setRequestScope((promise) => {
      waited.push(promise);
    });

    let ran = false;
    await Effect.runPromise(
      enqueueBackground(async () => {
        ran = true;
      }).pipe(Effect.provide(BackgroundWork.Live))
    );
    await Promise.all(waited);
    expect(waited).toHaveLength(1);
    expect(ran).toBe(true);
  });

  it('does not fail the foreground effect when scheduling throws', async () => {
    setRequestScope(() => {
      throw new Error('waitUntil can only be called within request scope');
    });

    await expect(
      Effect.runPromise(enqueueBackground(async () => {}).pipe(Effect.provide(BackgroundWork.Live)))
    ).resolves.toBeUndefined();
  });
});
