import { readFileSync } from 'fs'
import { describe, expect, it, vi } from 'vitest'
import { compileDsp, dspModule, dspProcessorOptions } from './dspModule'

describe('dspModule', () => {
  it('compila o concordDsp.wasm embutido uma vez só para o app inteiro', async () => {
    const module = await dspModule()
    expect(module).toBeInstanceOf(WebAssembly.Module)
    expect(await dspModule()).toBe(module)
    expect((await dspProcessorOptions()).dspModule).toBe(module)
  })

  it('o módulo exporta o que o worklet chama', async () => {
    const names = WebAssembly.Module.exports((await dspModule())!).map((e) => e.name)
    expect(names).toEqual(
      expect.arrayContaining([
        'memory',
        'dsp_input',
        'dsp_output',
        'dsp_capacity',
        'vm_init',
        'vm_configure',
        'vm_process'
      ])
    )
    // Sem imports: instancia em qualquer worklet, sem cola de JS.
    expect(WebAssembly.Module.imports((await dspModule())!)).toEqual([])
  })

  it('o .wasm é pequeno: os buffers ficam zerados (.bss), não gravados no binário', () => {
    const bytes = readFileSync(new URL('./concordDsp.wasm', import.meta.url))
    expect(bytes.length).toBeLessThan(48 * 1024)
  })

  it('WASM que não compila vira null (o worklet segue com o JS)', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(await compileDsp('data:application/wasm;base64,AAAA')).toBeNull()
    expect(console.error).toHaveBeenCalled()
  })
})
