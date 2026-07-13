// @ts-check
import { defineConfig } from 'astro/config';
import { fileURLToPath } from 'node:url';
import vercel from '@astrojs/vercel';
import svelte from '@astrojs/svelte';

import tailwindcss from '@tailwindcss/vite';

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
      alias: {
        '@data': fileURLToPath(new URL('../data', import.meta.url)),
        // Shared app server modules may import this; map to a process.env shim for Astro.
        '$env/dynamic/private': fileURLToPath(
          new URL('./src/shims/env-dynamic-private.ts', import.meta.url)
        )
      }
    }
  }
});
