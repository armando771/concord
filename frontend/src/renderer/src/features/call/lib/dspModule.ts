// O concordDsp.wasm (Rust, native/concord-dsp; gerado por
// scripts/build-dsp-wasm.sh) compilado uma vez para o app inteiro. Cada
// worklet do voice mod (um por microfone aberto) recebe o módulo já compilado
// em `processorOptions.dspModule` e só instancia — sem baixar nem recompilar.
// Inline (data URL): o app empacotado roda em file://, onde fetch não funciona.
import dspWasmDataUrl from './concordDsp.wasm?inline'
import { decodeDataUrl } from './dataUrl'

let compiled: Promise<WebAssembly.Module | null> | null = null

/** O módulo compilado, ou `null` se não compilar (o worklet segue com o JS). */
export function dspModule(): Promise<WebAssembly.Module | null> {
  compiled ??= compileDsp(dspWasmDataUrl)
  return compiled
}

export async function compileDsp(dataUrl: string): Promise<WebAssembly.Module | null> {
  try {
    return await WebAssembly.compile(decodeDataUrl(dataUrl))
  } catch (err) {
    console.error('[áudio] DSP em WASM indisponível — usando o JS:', err)
    return null
  }
}

/** `processorOptions` do worklet do voice mod. */
export async function dspProcessorOptions(): Promise<{ dspModule: WebAssembly.Module | null }> {
  return { dspModule: await dspModule() }
}
