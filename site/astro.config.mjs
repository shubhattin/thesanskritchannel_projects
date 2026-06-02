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
        '@data': fileURLToPath(new URL('../data', import.meta.url))
      }
    }
  }
});
