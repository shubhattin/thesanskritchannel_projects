# SvelteKit on workerd: use `event.platform`, not `cloudflare:*` imports

`cloudflare:workers` (and any `cloudflare:*` specifier) only exists inside
workerd. Node has no loader for the `cloudflare:` scheme, so any code Node
executes that statically imports it crashes with:

```text
Error [ERR_UNSUPPORTED_ESM_URL_SCHEME]: Only URLs with a scheme in: file, data,
and node are supported by the default ESM loader. Received protocol 'cloudflare:'
```

**SvelteKit runs server code in Node** during `vite dev` and during postbuild
route analysis (`@sveltejs/kit` → `core/postbuild/analyse.js` imports
`output/server/internal.js`, pulling in `hooks.server` and everything it
transitively imports). A static `cloudflare:workers` import anywhere reachable
from hooks or a server route therefore kills `vite build`, and it would equally
kill local `vite dev` when the chunk loads.

---

## How other frameworks differ (context only)

Some stacks run server code inside workerd during dev, so `cloudflare:*`
imports work there without extra plumbing:

| Framework | Dev server runtime | `cloudflare:workers` in dev? |
| --- | --- | --- |
| Astro + `@astrojs/cloudflare` | Full workerd emulation via the adapter | Yes |
| TanStack Start + `@cloudflare/vite-plugin` | Full workerd emulation (Vite Environment API) | Yes |
| SvelteKit + `adapter-cloudflare` (v7, Kit 2.x) | **Node**; adapter emulates **only `event.platform`** via `getPlatformProxy` (`{ env, ctx, caches, cf }` — no `cloudflare:*` module shimming) | No |

On SvelteKit, Cloudflare bindings and APIs are exposed **only** through
`event.platform` in `hooks.server.ts`, `+server.ts`, `+page.server.ts`, and
other server handlers — not via `import … from 'cloudflare:workers'`.

Upstream is closing the gap (SvelteKit PR #16754 adds a virtual
`cloudflare:workers` module for dev in the v3 prerelease line). This repo runs
the stable v2 line, so server code must work in three contexts: Node dev, Node
build-analysis, and workerd production.

Related: Miniflare does not emulate Cloudflare Images (nor Stream / Browser
Rendering). Even a full-workerd dev loop cannot transform images locally — the
local image path must be `sharp` on Node.

---

## Pattern: `CfEnv` Effect service (this repo)

Do **not** import `cloudflare:workers`. Bind Cloudflare from SvelteKit's
platform object once per request and consume it through Effect layers anywhere
the app runtime is available.

### 1. Request hook wires `event.platform` into the runtime

```ts
// app/src/hooks.server.ts
export const handle: Handle = ({ event, resolve }) =>
  runWithAppRuntime(event.platform, async () => resolve(event));
```

`runWithAppRuntime` (`app/src/effect/app_runtime.server.ts`) creates one
`ManagedRuntime` per request (via `AsyncLocalStorage`) and passes
`event.platform` into `makeAppRuntime`.

### 2. `CfEnv` reads bindings and `waitUntil` from the platform

```ts
// app/src/effect/cf_env.ts
export class CfEnv extends Context.Service<CfEnv, CfEnvValue>()('CfEnv') {
  static layer(platform: App.Platform) {
    return Layer.effect(CfEnv)(
      Effect.gen(function* () {
        const env = platform.env;
        const ctx = platform.ctx;
        if (!env) return yield* Effect.fail(missingPlatform);
        return {
          env,
          waitUntil: ctx
            ? ctx.waitUntil
            : (promise) => { void promise; }
        };
      })
    );
  }
}
```

- `env` — wrangler bindings (`IMAGES`, KV, R2, …) typed via `App.Platform` in
  `app.d.ts`.
- `waitUntil` — from `platform.ctx`; falls back to fire-and-forget on Node when
  `ctx` is absent (tests, some dev paths).

`CfEnv.Test` is provided when no platform is available (Vitest, scripts).

### 3. App layer merges `CfEnv` at the composition root

```ts
// app/src/effect/runtime_app.ts
export const makeAppLayer = (app, publicConfig, platform?: App.Platform) =>
  Layer.mergeAll(/* …services… */).pipe(
    Layer.provideMerge(platform ? CfEnv.layer(platform) : CfEnv.Test),
    /* … */
  );
```

### 4. Services yield `CfEnv` instead of importing workerd modules

**Background work** (`app/src/effect/background.ts`):

```ts
static readonly Live = Layer.effect(BackgroundWork)(
  Effect.gen(function* () {
    const cf = yield* CfEnv;
    return {
      enqueue: (work) =>
        Effect.sync(() => {
          const promise = Promise.resolve().then(work).catch(/* … */);
          cf.waitUntil(promise);
        })
    };
  })
);
```

**Cloudflare Images** (`app/src/effect/live/cf_images.ts`) reads the Images
binding from `yield* CfEnv` → `cf.env.IMAGES`.

From route handlers, tRPC, or `+server.ts`, use the existing runners
(`runServerEffect`, `runTrpcEffect`, …) — they resolve against the request
runtime that already has `CfEnv` in scope. No need to thread `event.platform`
through every call site.

The `site/` app uses the same `CfEnv` service via `site/src/hooks.server.ts` →
`runWithSiteRuntime(event.platform, …)`.

---

## Runtime live selection (images)

`app/src/effect/runtime_app.ts` picks the image live by runtime, keeping both
implementations dynamically imported so neither breaks the other's bundle —
`sharp` has native bindings and is additionally listed in
`build.rolldownOptions.external`:

```ts
const imageProcessorLive = Layer.unwrap(
  Effect.gen(function* () {
    if (isCloudflareWorker()) {
      return (yield* Effect.promise(() => import('./live/cf_images'))).ImageProcessorLive;
    }
    return (yield* Effect.promise(() => import('./live/sharp_images'))).ImageProcessorLive;
  })
);
```

- workerd → Cloudflare Images binding via `CfEnv` (dimensions via a pure-JS
  PNG/JPEG/WebP parser — Images converts but never reports metadata).
- Node (`vite dev`, `vite preview`, Vitest) → sharp, full fidelity.
- Neither module is ever *loaded* in the wrong runtime.

`isCloudflareWorker()` (`app/src/effect/platform.ts`) checks
`navigator.userAgent === 'Cloudflare-Workers'`.

---

## Rules

1. **Never** statically import a workerd-only specifier from SvelteKit server
   code. Use `event.platform` → `CfEnv` (or pass `platform` explicitly in hooks
   / server routes only).
2. Access bindings through `yield* CfEnv` inside Effect layers that are provided
   by the per-request runtime — not via top-level `cloudflare:*` imports.
3. For capabilities Miniflare does not emulate (Images), branch at runtime
   (`isCloudflareWorker()` + dynamic `import()`) and use a Node implementation
   locally.

---

## Same class: CJS-only deps break workerd boot

`import ws from 'ws'` (CJS-only) makes the bundler emit a
`createRequire(import.meta.url)` interop helper at module scope — and
`import.meta.url` is `undefined` on workerd, so the Worker fails to start.
Prefer the native `WebSocket` (Node 22+, Bun, workerd all have it) over the
`ws` package in any module that ships to the Worker. Check the built bundle:
`createRequire` must not appear outside comments.
