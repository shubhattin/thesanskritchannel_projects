import { defineConfig } from 'vitest/config';

export default defineConfig({
  resolve: {
    alias: {
      '@data': '../data'
    }
  },
  test: {
    environment: 'node'
  }
});
