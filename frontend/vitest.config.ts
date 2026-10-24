import { defineConfig } from 'vitest/config'

export default defineConfig({
  // Igual ao renderer (electron.vite.config.ts): o WASM do RNNoise é um asset.
  assetsInclude: ['**/*.wasm']
})
