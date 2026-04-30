import * as path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

const dir = path.dirname(fileURLToPath(import.meta.url))
const dataDir = path.resolve(dir, '../data')

export default defineConfig({
  root: dir,
  resolve: {
    alias: {
      '@data': dataDir,
    },
  },
  build: {
    ssr: path.resolve(__dirname, 'src/index.ts'),
    outDir: 'dist',
    emptyOutDir: true,
    target: 'node18',
    rollupOptions: {
      output: {
        entryFileNames: 'index.js',
      },
    },
  },
  ssr: {
    noExternal: true,
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
