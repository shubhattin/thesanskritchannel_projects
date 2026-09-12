import { describe, expect, it } from 'vitest';
import { Effect } from 'effect';
import { CfEnv } from '../cf_env';

describe('CfEnv.layer', () => {
  it('keeps the ExecutionContext receiver on waitUntil (workerd Illegal invocation)', async () => {
    const waited: Promise<unknown>[] = [];
    // Simulates workerd: native methods require the real receiver and throw
    // "TypeError: Illegal invocation" when called detached.
    const ctx = {
      waitUntil(promise: Promise<unknown>) {
        if (this !== ctx) {
          throw new TypeError(
            'Illegal invocation: function called with incorrect `this` reference.'
          );
        }
        waited.push(promise);
      }
    };

    const program = Effect.gen(function* () {
      const cf = yield* CfEnv;
      cf.waitUntil(Promise.resolve('work'));
    });

    await Effect.runPromise(
      // SAFETY: test double — `CfEnv.layer` only reads `env` (truthy check)
      // and `ctx.waitUntil`, both provided here.
      Effect.provide(program, CfEnv.layer({ env: {}, ctx } as App.Platform))
    );
    expect(waited).toHaveLength(1);
  });
});
