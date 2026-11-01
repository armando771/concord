// Ponte para o concordDsp.wasm (Rust, native/concord-dsp) dentro do
// AudioWorklet do voice mod: instancia o módulo compilado que a página manda em
// `processorOptions.dspModule` e troca blocos pela memória linear dele.
//
// Sem alocar por quantum: as views sobre os buffers do WASM são criadas uma
// vez (e de novo só se o tamanho do bloco mudar); a memória não cresce (o
// Rust não aloca), então as views nunca ficam soltas.
//
// Auto-contido (sem DOM): roda no worklet e nos testes.

/** Funções exportadas pelo concordDsp.wasm (ver native/concord-dsp/src/lib.rs). */
export interface DspExports {
  memory: WebAssembly.Memory
  dsp_input: () => number
  dsp_output: () => number
  dsp_capacity: () => number
  vm_init: (rate: number) => number
  vm_configure: (
    ratio: number,
    modHz: number,
    modDepth: number,
    vibratoHz: number,
    vibratoSemitones: number
  ) => void
  vm_process: (n: number, hasInput: number) => void
}

/** Entrada e saída de uma instância: copia blocos para dentro e para fora do WASM. */
export class DspIo {
  readonly capacity: number
  private inView: Float32Array
  private outView: Float32Array

  constructor(private readonly exports: DspExports) {
    this.capacity = exports.dsp_capacity()
    this.inView = this.view(exports.dsp_input(), 0)
    this.outView = this.view(exports.dsp_output(), 0)
  }

  /** Copia `input` (sem ela, nada) para um bloco de `n`; o que faltar vira silêncio. */
  write(input: Float32Array | undefined, n: number): number {
    this.resize(n)
    if (!input) return 0
    if (input.length === n) this.inView.set(input)
    else this.writePartial(input, n)
    return 1
  }

  /** Copia o último bloco processado para `output` (do mesmo tamanho do `write`). */
  read(output: Float32Array): void {
    output.set(this.outView)
  }

  private writePartial(input: Float32Array, n: number): void {
    this.inView.set(input.length > n ? input.subarray(0, n) : input)
    this.inView.fill(0, Math.min(input.length, n))
  }

  private resize(n: number): void {
    if (this.inView.length === n) return
    this.inView = this.view(this.exports.dsp_input(), n)
    this.outView = this.view(this.exports.dsp_output(), n)
  }

  private view(pointer: number, n: number): Float32Array {
    return new Float32Array(this.exports.memory.buffer, pointer, n)
  }
}

/**
 * Instancia o módulo (um por processador: o estado do Rust é estático). `null`
 * se não veio módulo ou se ele não instancia — quem chama usa o JS.
 */
export function instantiateDsp(module: unknown): DspExports | null {
  if (!(module instanceof WebAssembly.Module)) return null
  try {
    return new WebAssembly.Instance(module, {}).exports as unknown as DspExports
  } catch {
    return null
  }
}

/**
 * O pedaço [offset, offset + n) de `buffer`. Blocos maiores que a capacidade
 * do WASM são processados em pedaços; no quantum normal (128) é o bloco
 * inteiro e nada é alocado.
 */
export function chunkOf<T extends Float32Array | undefined>(
  buffer: T,
  offset: number,
  n: number
): T {
  if (!buffer || (offset === 0 && buffer.length === n)) return buffer
  return buffer.subarray(offset, offset + n) as T
}
