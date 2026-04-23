// @ts-check
import { defineConfig } from 'astro/config';
import { fileURLToPath } from 'node:url';
import vercel from '@astrojs/vercel';
import svelte from '@astrojs/svelte';

import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  output: 'server',
  // Lekha loads `src/content/**` at runtime via fs; Vercel NFT must bundle those files.
  // @astrojs/vercel merges `vite.assetsInclude` globs into the serverless function (see dist/index.js).
  adapter: vercel(),
  integrations: [svelte()],

  vite: {
    plugins: [tailwindcss()],
    assetsInclude: [
      'src/content/lekha_list.json',
      'src/content/lekha/**/*.json',
      'src/content/lekha_md/**/*.md'
    ],
    resolve: {
      alias: {
        '@data': fileURLToPath(new URL('../data', import.meta.url))
      }
    }
  }
});
