import { readFileSync } from 'fs'
import { resolve } from 'path'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import type { Plugin, UserConfig } from 'vite'
import { fillCsp } from './src/renderer/src/lib/serverUrl'

// O que o renderer tem igual no app desktop (electron.vite.config.ts) e no
// navegador (vite.web.config.ts): aliases, plugins e assets. Mexeu aqui, os
// dois builds acompanham.

/** Preenche a CSP do index.html com o que o build libera de rede e mídia. */
export function cspPlugin(connectSrc: string, mediaSrc: string, extra?: string): Plugin {
  return {
    name: 'concord-connect-src',
    transformIndexHtml: (html: string): string => fillCsp(html, { connectSrc, mediaSrc, extra })
  }
}

/**
 * A OFL exige que a licença (com o copyright "The Outfit Project Authors")
 * acompanhe toda cópia da fonte: vai como assets/OFL.txt, ao lado dos woff2,
 * no out/renderer (desktop) e no dist-web. O instalador também leva uma cópia
 * em resources/licenses (electron-builder.yml).
 */
export const fontLicensePlugin: Plugin = {
  name: 'salinha-font-license',
  apply: 'build',
  generateBundle() {
    this.emitFile({
      type: 'asset',
      fileName: 'assets/OFL.txt',
      source: readFileSync(resolve('node_modules/@fontsource-variable/outfit/LICENSE'), 'utf8')
    })
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
    plugins: [react(), tailwindcss(), fontLicensePlugin, ...extraPlugins],
    // O WASM do RNNoise entra inline (lib/noiseSuppression.ts).
    assetsInclude: ['**/*.wasm']
  }
}
