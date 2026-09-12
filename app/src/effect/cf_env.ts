import { Context, Effect, Layer } from 'effect';
import { ConfigError } from './errors';

export type CfEnvValue = {
  readonly env: App.Platform['env'];
  readonly waitUntil: (promise: Promise<unknown>) => void;
};

const missingPlatform = ConfigError.make({
  message: 'Cloudflare event.platform.env is missing'
});

/**
 * Per-request Cloudflare bindings + `waitUntil`, taken from SvelteKit
 * `event.platform` (emulated in `vite dev`, real on workerd).
 *
 * Prefer this over `cloudflare:workers` — that specifier only exists inside
 * workerd, so a SvelteKit Node analysis/dev path cannot load it.
 */
export class CfEnv extends Context.Service<CfEnv, CfEnvValue>()('CfEnv') {
  static layer(platform: App.Platform) {
    return Layer.effect(CfEnv)(
      Effect.gen(function* () {
        const env = platform.env;
        const ctx = platform.ctx;
        if (!env) {
          return yield* Effect.fail(missingPlatform);
        }
        return {
          env,
          // IMPORTANT: call as a method on ctx. Storing the bare reference
          // (`waitUntil: ctx.waitUntil`) loses `this` and workerd throws
          // "TypeError: Illegal invocation" on the first background call
          // (e.g. async cache write-back after a Redis miss).
          waitUntil: ctx
            ? (promise: Promise<unknown>) => ctx.waitUntil(promise)
            : (promise: Promise<unknown>) => {
                void promise;
              }
        };
      })
    );
  }

  /**
   * Tests / no request: `waitUntil` does not extend isolate lifetime.
   * Accessing `env` fails immediately — there are no bindings.
   */
  static readonly Test = Layer.succeed(CfEnv)({
    get env(): App.Platform['env'] {
      throw missingPlatform;
    },
    waitUntil: (promise) => {
      void promise;
    }
  });
}
