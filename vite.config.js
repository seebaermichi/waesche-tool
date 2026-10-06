import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { viteSingleFile } from 'vite-plugin-singlefile'

export default defineConfig({
  plugins: [vue(), tailwindcss(), viteSingleFile()],
  server: {
    proxy: {
      // Im Dev-Betrieb läuft das PHP-Backend separat: npm run dev:api
      '/api': {
        target: 'http://127.0.0.1:8787',
        changeOrigin: false,
      },
    },
  },
  build: {
    // Alles in index.html inline, damit auf dem Server nur feste Dateinamen liegen.
    assetsInlineLimit: Infinity,
  },
})
