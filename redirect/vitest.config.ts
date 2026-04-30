import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

const dir = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  root: dir,
  resolve: {
    alias: {
      '@data': path.resolve(dir, '../data'),
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
