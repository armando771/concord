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
// Fontes do estilo de nome (assets/nameFonts.css), todas OFL com copyright próprio.
const NAME_FONT_PACKAGES = [
  'bitter',
  'pacifico',
  'chango',
  'montserrat',
  'cinzel-decorative',
  'press-start-2p',
  'grenze-gotisch',
  'caveat',
  'zilla-slab',
  'oswald',
  'jetbrains-mono',
  'bungee',
  'silkscreen',
  'vt323',
  'dancing-script',
  'great-vibes',
  'unifrakturmaguntia',
  'space-mono',
  'fredoka',
  'comfortaa',
  'lobster',
  'righteous',
  'monoton',
  'bangers',
  'orbitron',
  'creepster'
]

export const fontLicensePlugin: Plugin = {
  name: 'salinha-font-license',
  apply: 'build',
  generateBundle() {
    const licenses: [string, string][] = [
      ['outfit', 'node_modules/@fontsource-variable/outfit/LICENSE'],
      ...NAME_FONT_PACKAGES.map((p): [string, string] => [p, `node_modules/@fontsource/${p}/LICENSE`])
    ]
    this.emitFile({
      type: 'asset',
      fileName: 'assets/OFL.txt',
      source: licenses
        .map(([name, file]) => `=== ${name} ===\n${readFileSync(resolve(file), 'utf8')}`)
        .join('\n\n')
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
    assetsInclude: ['**/*.wasm', '**/*.tflite']
  }
}
