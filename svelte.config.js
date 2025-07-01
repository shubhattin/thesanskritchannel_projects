import adapter_netlify from '@sveltejs/adapter-netlify';
import adapter_vercel from '@sveltejs/adapter-vercel';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

/** @type {import('@sveltejs/kit').Config} */
const config = {
  preprocess: vitePreprocess(),

  kit: {
    adapter:
      process.env.BUILD_MODE === 'vercel'
        ? adapter_vercel({
            runtime: 'nodejs20.x',
          })
        : adapter_netlify({
            edge: true
          }),
    alias: {
      '~': 'src',
      '@data': './data'
    }
  }
};

export default config;
