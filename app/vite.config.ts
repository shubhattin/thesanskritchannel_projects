import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import ViteYaml from '@modyfi/vite-plugin-yaml';

const appDir = path.dirname(fileURLToPath(import.meta.url));
/** carta-md does not export this module; alias is used for custom toolbar ordering. */
const cartaMdDefaultIconsFile = path.join(appDir, 'node_modules/carta-md/dist/internal/icons.js');

const s3BrowserRuntimeConfig = path.join(
  appDir,
  'node_modules/@aws-sdk/client-s3/dist-es/runtimeConfig.browser.js'
);

/**
 * S3Client imports `./runtimeConfig` (Node). Point that at the fetch-based
 * browser build — the Node runtime's named imports break under workerd.
 */
const awsS3WorkersRuntime = {
  name: 'aws-s3-workers-runtime',
  enforce: 'pre' as const,
  resolveId(id: string, importer?: string) {
    if (
      (id === './runtimeConfig' || id === './runtimeConfig.js') &&
      importer?.replaceAll('\\', '/').includes('@aws-sdk/client-s3/dist-es/')
    ) {
      return s3BrowserRuntimeConfig;
    }
    return undefined;
  }
};

export default defineConfig({
  resolve: {
    alias: {
      'carta-md-default-icons': cartaMdDefaultIconsFile
    }
  },
  plugins: [awsS3WorkersRuntime, tailwindcss(), sveltekit(), ViteYaml()],
  server: {
    fs: {
      allow: ['../data', './static/img']
    }
  },
  // Do not pre-bundle the Node AWS runtime into SSR; that skips the remap above.
  ssr: {
    optimizeDeps: {
      exclude: ['@aws-sdk/client-s3']
    }
  },
  build: {
    // `cloudflare:workers` only exists on workerd — keep the (lazy) imports
    // as-is in the server bundle instead of failing resolution at build time.
    rolldownOptions: {
      external: ['cloudflare:workers']
    }
  },
  worker: {
    format: 'es'
  }
});
