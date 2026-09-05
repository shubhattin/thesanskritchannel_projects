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
