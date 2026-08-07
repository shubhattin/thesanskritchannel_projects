import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vitest/config';

const root = path.dirname(fileURLToPath(import.meta.url));
const src = path.resolve(root, 'src');

export default defineConfig({
  resolve: {
    alias: {
      '~': src,
      '@data': path.resolve(root, '../data')
    }
  },
  test: {
    environment: 'node',
    setupFiles: ['./src/effect/tests/test_setup.ts'],
    fileParallelism: false
  }
});
