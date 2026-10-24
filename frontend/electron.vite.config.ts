import { resolve } from 'path'
import { defineConfig } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { buildConnectSrc } from './src/renderer/src/lib/serverUrl'

// A CSP do renderer precisa liberar o servidor embutido no build.
const connectSrcPlugin = {
  name: 'concord-connect-src',
  transformIndexHtml: (html: string): string =>
    html.replace('%CONCORD_CONNECT_SRC%', buildConnectSrc(process.env.VITE_SERVER_URL))
}

export default defineConfig({
  main: {},
  preload: {},
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src')
      }
    },
    plugins: [react(), tailwindcss(), connectSrcPlugin]
  }
})
