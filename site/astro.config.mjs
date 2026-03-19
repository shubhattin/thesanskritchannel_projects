// @ts-check
import { defineConfig } from 'astro/config';
import { fileURLToPath } from 'node:url';
import node from '@astrojs/node';

import svelte from '@astrojs/svelte';

import tailwindcss from '@tailwindcss/vite';

// https://astro.build/config
export default defineConfig({
  output: 'server',
  adapter: node({
    mode: 'standalone'
  }),
  integrations: [svelte()],

  vite: {
    plugins: [tailwindcss()],
    resolve: {
      alias: {
        '@data': fileURLToPath(new URL('../data', import.meta.url))
      }
    }
  }
});
