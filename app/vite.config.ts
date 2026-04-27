import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import ViteYaml from '@modyfi/vite-plugin-yaml';

const appDir = path.dirname(fileURLToPath(import.meta.url));
/** carta-md does not export this module; alias is used for custom toolbar ordering. */
const cartaMdDefaultIconsFile = path.join(appDir, 'node_modules/carta-md/dist/internal/icons.js');

export default defineConfig({
  resolve: {
    alias: {
      'carta-md-default-icons': cartaMdDefaultIconsFile
    }
  },
  plugins: [tailwindcss(), sveltekit(), ViteYaml()],
  server: {
    fs: {
      allow: ['../data', './static/img']
    }
  },
  worker: {
    format: 'es'
  }
});
