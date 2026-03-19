import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@data': fileURLToPath(new URL('../data', import.meta.url))
    }
  },
  test: {
    environment: 'node'
  }
});
