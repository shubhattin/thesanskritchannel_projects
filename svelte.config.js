import adapter_netlify from '@sveltejs/adapter-netlify';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),

  kit: {
    adapter: adapter_netlify({
      edge: true
    }),
    alias: {
      '~': 'src',
      '@data': './data'
    }
  }
};

export default config;
