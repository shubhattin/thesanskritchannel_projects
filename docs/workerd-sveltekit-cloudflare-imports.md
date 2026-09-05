# SvelteKit on workerd: `cloudflare:*` imports break the build

`cloudflare:workers` (and any `cloudflare:*` specifier) only exists inside
workerd. Node has no loader for the `cloudflare:` scheme, so any code Node
executes that statically imports it crashes with:

```text
Error [ERR_UNSUPPORTED_ESM_URL_SCHEME]: Only URLs with a scheme in: file, data,
and node are supported by the default ESM loader. Received protocol 'cloudflare:'
```

On Astro / TanStack Start this never bites: neither framework executes the
server bundle in Node during `vite build`. **SvelteKit does** — postbuild route
analysis imports the built server modules in plain Node
(`@sveltejs/kit/src/exports/vite/index.js` → `core/postbuild/analyse.js`,
which `import()`s `output/server/internal.js`, pulling in `hooks.server` and
everything it transitively imports). A static `cloudflare:workers` import
anywhere reachable from hooks or a server route therefore kills `vite build`,
and it would equally kill local `vite dev` when the chunk loads.

Verified in this repo: reverting `site/src/effect/live/background.ts` to a
static `import { waitUntil } from 'cloudflare:workers'` fails the site build
with exactly the error above (exit 1); the lazy form below builds clean.

---

## Why the frameworks differ (dev runtimes, verified)

`cloudflare:workers` resolves **only** where modules execute inside workerd:

| Framework | `vite dev` executes server code in… | `cloudflare:workers` in dev? |
| --- | --- | --- |
| TanStack Start + `@cloudflare/vite-plugin` | **workerd** (Vite Environment API; the plugin's README: *"Your Worker code runs inside workerd"*) | Yes, native |
| Astro + `@astrojs/cloudflare` | **Node** (docs' local story is `astro build && wrangler dev`, i.e. real workerd on a prod build) | Only on workerd |
| SvelteKit + `adapter-cloudflare` (v7, Kit 2.x) | **Node**; the adapter emulates **only `event.platform`** via `getPlatformProxy` (verified in adapter source: `emulate()` returns `{ env, ctx, caches, cf }`, no module shimming) | No |

Upstream knows the gap: SvelteKit PR #16754 (*"remove cloudflare `platform`, emulate the `cloudflare:workers` module instead"*, merged Aug 2026 into the **v3 prerelease** line) adds a `virtual-cloudflare-workers.js` module for dev — not available on the stable v2 line this repo runs. Until that lands stable, SvelteKit code must run in three contexts (Node dev, Node build-analysis, workerd prod) and pick implementations at runtime.

Related, from the Cloudflare skill references: **Miniflare does not emulate Cloudflare Images** (nor Stream / Browser Rendering), and the wrangler skill lists Images as remote-only for local dev. So even a full-workerd dev loop cannot transform images locally — the local image path must be `sharp` on Node.

---

## Pattern: runtime live selection (images)

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

- workerd → Cloudflare Images binding (dimensions via a pure-JS
  PNG/JPEG/WebP parser — Images converts but never reports metadata).
- Node (`vite dev`, `vite preview`, Vitest) → sharp, full fidelity.
- Neither module is ever *loaded* in the wrong runtime: build analysis only
  loads the selector, and each branch's chunk loads on first use.

---

## Rule

Never statically import a workerd-only specifier from SvelteKit server code.
Use a lazy `import()` that is never executed during build analysis, with a
fire-and-forget fallback for Node (local `vite dev`, Vitest):

```ts
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
```

On workerd the dynamic import resolves the real `waitUntil` (verified:
`{"resolved":true,"waitUntil":"function"}` against local workerd). Outside
workerd the rejection branch runs the work inline without blocking.

Two build-config companions, both required:

1. `build.rolldownOptions.external: ['cloudflare:workers']` in
   `site/vite.config.ts` — otherwise Vite fails the build at resolution time
   with *"Rolldown failed to resolve import … add it to
   `build.rolldownOptions.external`"*. (The alternative, `event.platform.ctx`,
   avoids the specifier entirely but threads request context through layers;
   the lazy import keeps the layer static and matches the Astro implementation.)
2. A local ambient declaration (`site/src/cloudflare-workers.d.ts`), because
   TypeScript resolves `@cloudflare/workers-types` to `index.ts`, never loading
   the `declare module "cloudflare:workers"` block that lives in `index.d.ts`.

---

## Same class: CJS-only deps break workerd boot

`import ws from 'ws'` (CJS-only) makes the bundler emit a
`createRequire(import.meta.url)` interop helper at module scope — and
`import.meta.url` is `undefined` on workerd, so the Worker fails to start
(verified with a minimal worker: `createRequire(import.meta.url)` alone
reproduces it; the proven TanStack app avoids `ws` entirely). Prefer the
native `WebSocket` (Node 22+, Bun, workerd all have it) over the `ws` package
in any module that ships to the Worker. Check the built bundle:
`createRequire` must not appear outside comments.
