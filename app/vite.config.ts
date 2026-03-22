import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import ViteYaml from '@modyfi/vite-plugin-yaml';

export default defineConfig({
  plugins: [tailwindcss(), sveltekit(), ViteYaml()],
  server: {
    fs: {
      allow: ['./data', './static/img']
    }
  },
  worker: {
    format: 'es'
  }
});
