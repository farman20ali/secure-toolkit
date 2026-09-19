/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

const repoName = 'secure-toolkit'

export default defineConfig(({ mode }) => ({
  base: mode === 'production' ? `/${repoName}/` : '/',
  plugins: [react(), tailwindcss()],
  server: {
    proxy: {
      // Forward /api/* to the local SMTP relay server so the browser
      // never has to make a cross-origin request to port 3001.
      '/api': {
        target: 'http://127.0.0.1:3001',
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
  },
}))
