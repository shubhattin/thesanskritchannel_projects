import { fileURLToPath } from 'node:url';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';

const appSrc = fileURLToPath(new URL('../app/src', import.meta.url));
const siteSrc = fileURLToPath(new URL('./src', import.meta.url));
const dataDir = fileURLToPath(new URL('../data', import.meta.url));

export default defineConfig({
  plugins: [tailwindcss(), sveltekit()],
  server: {
    fs: {
      allow: ['../data', '../app/src']
    }
  },
  build: {
    // `cloudflare:workers` only exists on workerd — keep the (lazy) import
    // as-is in the server bundle instead of failing resolution at build time.
    rolldownOptions: {
      external: ['cloudflare:workers']
    }
  },
  // Svelte UI packages ship `.svelte` source — exclude from esbuild dep scan.
  optimizeDeps: {
    exclude: [
      '@lucide/svelte',
      'lucide-svelte',
      'bits-ui',
      'svelte-icons-pack',
      'embla-carousel-svelte'
    ]
  },
  ssr: {
    noExternal: [
      '@lucide/svelte',
      'lucide-svelte',
      'bits-ui',
      'svelte-icons-pack',
      'embla-carousel-svelte'
    ]
  },
  resolve: {
    // Keep in sync with svelte.config.js aliases.
    // `@app` → admin app/src. Do not use `$app` (Kit virtual modules).
    alias: [
      { find: '@data', replacement: dataDir },
      { find: '@app', replacement: appSrc },
      { find: '$components', replacement: `${siteSrc}/components` },

      // Site-owned modules must win over app `~/` remaps.
      {
        find: '~/effect/site_runtime',
        replacement: `${siteSrc}/effect/site_runtime.server.ts`
      },
      {
        find: '~/utils/text-routes',
        replacement: `${siteSrc}/utils/text-routes.ts`
      },
      { find: /^~\/lib\//, replacement: `${siteSrc}/lib/` },
      { find: /^~\/components\//, replacement: `${siteSrc}/components/` },

      // App remaps for imports inside `@app/*` sources.
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
});
