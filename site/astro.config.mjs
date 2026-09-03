// @ts-check
import { defineConfig } from 'astro/config';
import { fileURLToPath } from 'node:url';
import vercel from '@astrojs/vercel';
import svelte from '@astrojs/svelte';

import tailwindcss from '@tailwindcss/vite';

const appSrc = fileURLToPath(new URL('../app/src', import.meta.url));
const siteSrc = fileURLToPath(new URL('./src', import.meta.url));
const dataDir = fileURLToPath(new URL('../data', import.meta.url));

// https://astro.build/config
export default defineConfig({
  output: 'server',
  adapter: vercel(),
  integrations: [svelte()],
  security: {
    checkOrigin: process.env.NODE_ENV === 'production',
    allowedDomains: [
      { hostname: 'thesanskritchannel.org', protocol: 'https' },
      { hostname: 'www.thesanskritchannel.org', protocol: 'https' }
    ]
  },

  vite: {
    plugins: [tailwindcss()],
    resolve: {
      // Keep in sync with site/tsconfig.json paths. Explicit Vite aliases are required so
      // `$app/*` modules (under ../app/src) can resolve their `~/…` imports in Vite 8 SSR.
      alias: [
        { find: '@data', replacement: dataDir },
        { find: '$app', replacement: appSrc },
        { find: '$components', replacement: `${siteSrc}/components` },
        { find: '$lib', replacement: `${siteSrc}/lib` },

        // Site-owned modules must win over app `~/` remaps.
        {
          find: '~/effect/site_runtime',
          replacement: `${siteSrc}/effect/site_runtime.ts`
        },
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
