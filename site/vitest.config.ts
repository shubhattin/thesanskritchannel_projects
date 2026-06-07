import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

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
