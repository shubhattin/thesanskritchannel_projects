import adapter from '@sveltejs/adapter-cloudflare';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';
import { fileURLToPath } from 'node:url';

const appSrc = fileURLToPath(new URL('../app/src', import.meta.url));

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),
  kit: {
    adapter: adapter(),
    alias: {
      $components: 'src/components',
      '@data': '../data',
      // Admin app source — `@app` (NOT `$app`, which is reserved by SvelteKit).
      '@app': appSrc,
      // Site-owned tilde paths must be listed before app package remaps.
      '~/effect/site_runtime': 'src/effect/site_runtime.server.ts',
      '~/utils/text-routes': 'src/utils/text-routes.ts',
      '~/lib': 'src/lib',
      '~/components': 'src/components',
      // App `~/` remaps (for typecheck + resolve inside `@app/*` sources).
      '~/db': '../app/src/db',
      '~/effect': '../app/src/effect',
      '~/state': '../app/src/state',
      '~/utils': '../app/src/utils',
      '~/tools': '../app/src/tools',
      '~/api': '../app/src/api',
      '~/constants': '../app/src/constants.ts'
    },
    files: {
      assets: 'public'
    }
  }
};

export default config;
