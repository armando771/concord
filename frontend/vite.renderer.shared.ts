import { resolve } from 'path'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import type { Plugin, UserConfig } from 'vite'

// O que o renderer tem igual no app desktop (electron.vite.config.ts) e no
// navegador (vite.web.config.ts): aliases, plugins e assets. Mexeu aqui, os
// dois builds acompanham.

/** Preenche a CSP do index.html com o que o build libera de rede e mídia. */
export function cspPlugin(connectSrc: string, mediaSrc: string): Plugin {
  return {
    name: 'concord-connect-src',
    transformIndexHtml: (html: string): string =>
      html.replace('%CONCORD_CONNECT_SRC%', connectSrc).replaceAll('%CONCORD_MEDIA_SRC%', mediaSrc)
  }
}

export function rendererShared(
  ...extraPlugins: Plugin[]
): Pick<UserConfig, 'resolve' | 'plugins' | 'assetsInclude'> {
  return {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src')
      }
    },
    plugins: [react(), tailwindcss(), ...extraPlugins],
    // O WASM do RNNoise entra inline (lib/noiseSuppression.ts).
    assetsInclude: ['**/*.wasm']
  }
}
