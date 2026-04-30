import path from 'node:path'
import { defineConfig } from 'vitest/config'

const dataDir = path.resolve(__dirname, '../data')

export default defineConfig({
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
