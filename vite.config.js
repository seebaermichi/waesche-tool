import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import tailwindcss from '@tailwindcss/vite'
import { viteSingleFile } from 'vite-plugin-singlefile'
import { readFileSync, writeFileSync } from 'node:fs'

const { version } = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8'))

// public/sw.js wird 1:1 kopiert – die Versionsnummer danach in der Kopie einsetzen.
function swVersion() {
  let outDir
  return {
    name: 'sw-version',
    apply: 'build',
    configResolved(config) {
      outDir = config.build.outDir
    },
    closeBundle() {
      const file = `${outDir}/sw.js`
      writeFileSync(file, readFileSync(file, 'utf8').replace('__APP_VERSION__', version))
    },
  }
}

export default defineConfig({
  plugins: [vue(), tailwindcss(), viteSingleFile(), swVersion()],
  define: {
    __APP_VERSION__: JSON.stringify(version),
  },
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
