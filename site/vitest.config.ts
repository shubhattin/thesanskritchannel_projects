import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  resolve: {
    alias: {
      '$app': fileURLToPath(new URL('../app/src', import.meta.url)),
      '@data': fileURLToPath(new URL('../data', import.meta.url))
    }
  },
  test: {
    environment: 'node'
  }
});
