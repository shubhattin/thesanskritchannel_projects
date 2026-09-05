import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

const appSrc = fileURLToPath(new URL('../app/src', import.meta.url));
const siteSrc = fileURLToPath(new URL('./src', import.meta.url));

export default defineConfig({
  resolve: {
    alias: [
      { find: '@data', replacement: fileURLToPath(new URL('../data', import.meta.url)) },
      { find: '@app', replacement: appSrc },
      { find: '$components', replacement: `${siteSrc}/components` },
      { find: '$lib', replacement: `${siteSrc}/lib` },
      {
        find: '~/effect/site_runtime',
        replacement: `${siteSrc}/effect/site_runtime.server.ts`
      },
      { find: /^~\/effect\/live\//, replacement: `${siteSrc}/effect/live/` },
      { find: '$env/dynamic/private', replacement: `${siteSrc}/effect/live/sveltekit_env_stub.ts` },
      { find: '$env/dynamic/public', replacement: `${siteSrc}/effect/live/sveltekit_env_stub.ts` },
      {
        find: '~/utils/text-routes',
        replacement: `${siteSrc}/utils/text-routes.ts`
      },
      { find: /^~\/lib\//, replacement: `${siteSrc}/lib/` },
      { find: /^~\/components\//, replacement: `${siteSrc}/components/` },
      { find: /^~\/db\//, replacement: `${appSrc}/db/` },
      { find: /^~\/effect\//, replacement: `${appSrc}/effect/` },
      { find: /^~\/state\//, replacement: `${appSrc}/state/` },
      { find: /^~\/utils\//, replacement: `${appSrc}/utils/` },
      { find: /^~\/tools\//, replacement: `${appSrc}/tools/` },
      { find: /^~\/api\//, replacement: `${appSrc}/api/` },
      { find: '~/constants', replacement: `${appSrc}/constants.ts` },
      { find: /^~\//, replacement: `${siteSrc}/` }
    ]
  },
  test: {
    environment: 'node'
  }
});
