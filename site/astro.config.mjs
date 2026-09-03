// @ts-check
import { defineConfig } from 'astro/config';
import { fileURLToPath } from 'node:url';
import cloudflare from '@astrojs/cloudflare';
import svelte from '@astrojs/svelte';

import tailwindcss from '@tailwindcss/vite';

const appSrc = fileURLToPath(new URL('../app/src', import.meta.url));
const siteSrc = fileURLToPath(new URL('./src', import.meta.url));
const dataDir = fileURLToPath(new URL('../data', import.meta.url));
// Astro 7.3.0 injects `astro/_internal/logger` into asset runtime code, but that
// subpath is stripped from the published package exports (monorepo-only). Resolve
// via the real package location (works when bun hoists under root `.bun/`).
const astroInternalLogger = fileURLToPath(
  new URL('./dist/core/logger/core.js', import.meta.resolve('astro/package.json'))
);

// https://astro.build/config
export default defineConfig({
  output: 'server',
  adapter: cloudflare({
    // Site does not use astro:assets. Avoid Sharp / Images binding at build time.
    imageService: 'passthrough'
  }),
  integrations: [svelte()],
  security: {
    checkOrigin: process.env.NODE_ENV === 'production',
    allowedDomains: [
      { hostname: 'thesanskritchannel.org', protocol: 'https' },
      { hostname: 'www.thesanskritchannel.org', protocol: 'https' }
    ]
  },

  vite: {
    // CI / Workers Builds: do not bake a workspace `.env` into the Worker.
    // Local `astro dev` still loads `.env` via Vite. Runtime secrets in prod
    // come from the dashboard (Variables and Secrets), not from this file.
    envDir: process.env.CI === 'true' ? false : undefined,
    plugins: [tailwindcss()],
    optimizeDeps: {
      // svelte-icons-pack emits hashed Icon chunks that vanish on HMR; Vite then
      // warns that optimize-deps files are missing. Keep it out of the optimizer.
      exclude: ['svelte-icons-pack']
    },
    ssr: {
      optimizeDeps: {
        exclude: ['svelte-icons-pack']
      }
    },
    resolve: {
      // Keep in sync with site/tsconfig.json paths. Explicit Vite aliases are required so
      // `$app/*` modules (under ../app/src) can resolve their `~/…` imports in Vite 8 SSR.
      alias: [
        { find: 'astro/_internal/logger', replacement: astroInternalLogger },
        { find: '@data', replacement: dataDir },
        { find: '$app', replacement: appSrc },
        { find: '$components', replacement: `${siteSrc}/components` },
        { find: '$lib', replacement: `${siteSrc}/lib` },

        // Site-owned modules must win over app `~/` remaps.
        {
          find: '~/effect/site_runtime',
          replacement: `${siteSrc}/effect/site_runtime.ts`
        },
        { find: /^~\/effect\/live\//, replacement: `${siteSrc}/effect/live/` },
        {
          find: '~/utils/text-routes',
          replacement: `${siteSrc}/utils/text-routes.ts`
        },
        { find: /^~\/lib\//, replacement: `${siteSrc}/lib/` },
        { find: /^~\/components\//, replacement: `${siteSrc}/components/` },

        // App remaps for imports inside `$app/*` sources.
        { find: /^~\/db\//, replacement: `${appSrc}/db/` },
        { find: /^~\/effect\//, replacement: `${appSrc}/effect/` },
        { find: /^~\/state\//, replacement: `${appSrc}/state/` },
        { find: /^~\/utils\//, replacement: `${appSrc}/utils/` },
        { find: /^~\/tools\//, replacement: `${appSrc}/tools/` },
        { find: /^~\/api\//, replacement: `${appSrc}/api/` },
        { find: '~/constants', replacement: `${appSrc}/constants.ts` },

        // Fallback for remaining site `~/` paths.
        { find: /^~\//, replacement: `${siteSrc}/` }
      ]
    }
  }
});
