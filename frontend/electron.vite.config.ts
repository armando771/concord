import { resolve } from 'path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { buildConnectSrc, buildMediaSrc } from './src/renderer/src/lib/serverUrl'

// A CSP do renderer precisa liberar o servidor embutido no build (API,
// WebSocket e os arquivos de mídia do chat).
const connectSrcPlugin = {
  name: 'concord-connect-src',
  transformIndexHtml: (html: string): string =>
    html
      .replace('%CONCORD_CONNECT_SRC%', buildConnectSrc(process.env.VITE_SERVER_URL))
      .replaceAll('%CONCORD_MEDIA_SRC%', buildMediaSrc(process.env.VITE_SERVER_URL))
}

// Atualizações: servidas pelo próprio servidor e assinadas pelo dono.
const serverUrl = process.env.VITE_SERVER_URL?.trim()
const updateUrl = serverUrl ? new URL('/updates/', serverUrl).toString() : ''

export default defineConfig({
  main: {
    define: {
      __CONCORD_UPDATE_URL__: JSON.stringify(updateUrl),
      __CONCORD_UPDATE_PUBKEY__: JSON.stringify(process.env.CONCORD_UPDATE_PUBKEY ?? '')
    }
  },
  preload: {},
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src')
      }
    },
    plugins: [react(), tailwindcss(), connectSrcPlugin],
    // Duas páginas: o app e o overlay de jogo (janela à parte, sem rede).
    build: {
      rollupOptions: {
        input: {
          index: resolve('src/renderer/index.html'),
          overlay: resolve('src/renderer/overlay.html')
        }
      }
    },
    // O WASM do RNNoise entra inline (lib/noiseSuppression.ts).
    assetsInclude: ['**/*.wasm']
  }
})
