import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

const INDEXER_ORIGIN = 'https://dpmf-xdx-indexer-production.up.railway.app'

export default defineConfig({
  plugins: [react()],
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/api': {
        target: INDEXER_ORIGIN,
        changeOrigin: true,
      },
      '/xaman': {
        target: INDEXER_ORIGIN,
        changeOrigin: true,
      },
      '/health': {
        target: INDEXER_ORIGIN,
        changeOrigin: true,
      },
    },
  },
})
