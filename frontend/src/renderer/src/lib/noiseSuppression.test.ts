import { readFileSync } from 'fs'
import { createRequire } from 'module'
import { dirname, join } from 'path'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// ─── RNNoise de verdade (o worklet + WASM que o app carrega) ────────────────

const pkgDir = dirname(
  dirname(createRequire(import.meta.url).resolve('@sapphi-red/web-noise-suppressor'))
)
const BLOCK = 128
const RATE = 48_000

interface WorkletProcessor {
  processor?: unknown
  process: (inputs: Float32Array[][], outputs: Float32Array[][]) => boolean
  destroy: () => void
}

type ProcessorClass = new (options: unknown) => WorkletProcessor
let Processor: ProcessorClass | undefined

/** Carrega o worklet uma vez (o import fica em cache) e guarda a classe registrada. */
async function processorClass(): Promise<ProcessorClass> {
  if (Processor) return Processor
  const g = globalThis as Record<string, unknown>
  g.AudioWorkletProcessor ??= class {
    port = { addEventListener: () => {}, start: () => {}, postMessage: () => {} }
  }
  g.registerProcessor = (_: string, cls: ProcessorClass): void => {
    Processor = cls
  }
  await import('@sapphi-red/web-noise-suppressor/rnnoiseWorklet.js')
  if (!Processor) throw new Error('o worklet não registrou o processador')
  return Processor
}

async function realRnnoise(): Promise<(input: Float32Array) => Float32Array> {
  const Rnnoise = await processorClass()
  const wasmBinary = readFileSync(join(pkgDir, 'dist/rnnoise_simd.wasm')).buffer
  // O glue do Emscripten detecta o Node pelo `process` (no AudioWorklet não
  // existe) — a detecção é síncrona, no construtor.
  const realProcess = globalThis.process
  Object.defineProperty(globalThis, 'process', { value: undefined, configurable: true })
  let proc: WorkletProcessor
  try {
    proc = new Rnnoise({ processorOptions: { wasmBinary, maxChannels: 1 } })
  } finally {
    Object.defineProperty(globalThis, 'process', { value: realProcess, configurable: true })
  }
  await vi.waitFor(() => expect(proc.processor).toBeDefined())
  return (input) => {
    const out = new Float32Array(input.length)
    for (let i = 0; i + BLOCK <= input.length; i += BLOCK) {
      const block = new Float32Array(BLOCK)
      proc.process([[input.subarray(i, i + BLOCK)]], [[block]])
      out.set(block, i)
    }
    return out
  }
}

const dbfs = (s: Float32Array): number => {
  let sum = 0
  for (const v of s) sum += v * v
  return 10 * Math.log10(sum / s.length + 1e-12)
}

/** Ruído de "ventilador" (marrom + rosa), determinístico. */
function fanNoise(seconds: number, amplitude: number): Float32Array {
  let seed = 7
  const rnd = (): number => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648) * 2 - 1
  const out = new Float32Array(seconds * RATE)
  let brown = 0
  let pink = 0
  for (let i = 0; i < out.length; i++) {
    const w = rnd()
    brown = 0.995 * brown + 0.05 * w
    pink = 0.9 * pink + 0.1 * w
    out[i] = 0.6 * brown + 0.5 * pink
  }
  const k = amplitude / Math.sqrt(out.reduce((a, v) => a + v * v, 0) / out.length)
  return out.map((v) => v * k)
}

/** Depois de 1 s (o RNNoise aprende o ruído), para comparar regime. */
const steady = (s: Float32Array): Float32Array => s.subarray(RATE)

describe('RNNoise (xiph/rnnoise em WASM)', () => {
  it('remove ruído de ventilador em nível de conversa (−30 dBFS) em mais de 30 dB', async () => {
    const denoise = await realRnnoise()
    const noise = fanNoise(4, 0.03)
    const out = denoise(noise)
    expect(dbfs(steady(noise))).toBeCloseTo(-30, 0)
    expect(dbfs(steady(noise)) - dbfs(steady(out))).toBeGreaterThan(30)
  })

  it('ruído acima de 0,05 (onde o filtro falso antigo não mexia) também some', async () => {
    const denoise = await realRnnoise()
    const noise = fanNoise(4, 0.1)
    expect(dbfs(steady(noise)) - dbfs(steady(denoise(noise)))).toBeGreaterThan(30)
  })

  it('silêncio entra, silêncio sai (sem zumbido gerado)', async () => {
    const denoise = await realRnnoise()
    const out = denoise(new Float32Array(2 * RATE))
    expect(out.every(Number.isFinite)).toBe(true)
    expect(dbfs(out)).toBeLessThan(-90)
  })
})

// ─── Pipeline do microfone (AudioContext/getUserMedia simulados) ────────────

const node = vi.hoisted(() => ({
  instances: [] as Array<{ channelCount: number; channelCountMode: string; destroy: () => void }>
}))
vi.mock('@sapphi-red/web-noise-suppressor', () => ({
  RnnoiseWorkletNode: class {
    channelCount = 2
    channelCountMode = 'max'
    destroy = vi.fn()
    connect = (next: unknown): unknown => next
    constructor() {
      node.instances.push(this)
    }
  }
}))

interface FakeGain {
  gain: {
    value: number
    cancelScheduledValues: () => void
    setValueAtTime: (v: number) => void
    setTargetAtTime: (v: number) => void
  }
  connect: ReturnType<typeof vi.fn>
  disconnect: ReturnType<typeof vi.fn>
}

const fake = {
  contexts: [] as Array<{ close: ReturnType<typeof vi.fn>; gains: FakeGain[] }>,
  addModule: vi.fn(async () => {}),
  getUserMedia: vi.fn()
}

function fakeGain(): FakeGain {
  const g: FakeGain = {
    gain: {
      value: 1,
      cancelScheduledValues: () => {},
      setValueAtTime: (v) => {
        g.gain.value = v
      },
      setTargetAtTime: (v) => {
        g.gain.value = v
      }
    },
    connect: vi.fn((next: unknown) => next),
    disconnect: vi.fn()
  }
  return g
}

/** AudioWorkletNode da detecção de fala (o do RNNoise é mockado à parte). */
class FakeWorkletNode {
  static instances: FakeWorkletNode[] = []
  port = {
    onmessage: null as ((e: { data: boolean }) => void) | null,
    close: vi.fn()
  }
  connect = vi.fn((next: unknown) => next)
  disconnect = vi.fn()
  constructor(
    public ctx: unknown,
    public name: string
  ) {
    FakeWorkletNode.instances.push(this)
  }
}
vi.stubGlobal('AudioWorkletNode', FakeWorkletNode)

class FakeAudioContext {
  state = 'running'
  currentTime = 0
  audioWorklet = { addModule: fake.addModule }
  gains: FakeGain[] = []
  close = vi.fn(async () => {})
  outTrack = { stop: vi.fn() }
  constructor() {
    fake.contexts.push(this)
  }
  createMediaStreamSource = (): { connect: (n: unknown) => unknown } => ({ connect: (n) => n })
  createGain = (): FakeGain => {
    const g = fakeGain()
    this.gains.push(g)
    return g
  }
  destination = { stream: { getTracks: () => [this.outTrack] } }
  createMediaStreamDestination = (): { stream: { getTracks: () => unknown[] } } => this.destination
  resume = async (): Promise<void> => {}
}

function rawStream(): { getTracks: () => Array<{ stop: ReturnType<typeof vi.fn> }> } {
  const tracks = [{ stop: vi.fn() }]
  return { getTracks: () => tracks }
}

vi.stubGlobal('AudioContext', FakeAudioContext)
vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: fake.getUserMedia } })

const { openMicrophone } = await import('./noiseSuppression')
const { useNoiseSuppressionStore } = await import('../store/noiseSuppressionStore')

/** [wet, dry] do último contexto criado. */
const gains = (): number[] => fake.contexts.at(-1)!.gains.map((g) => g.gain.value)

describe('openMicrophone', () => {
  beforeEach(() => {
    fake.contexts.length = 0
    node.instances.length = 0
    fake.addModule.mockReset().mockResolvedValue(undefined)
    fake.getUserMedia.mockReset().mockImplementation(async () => rawStream())
    useNoiseSuppressionStore.setState({ enabled: true, available: true })
  })

  it('abre o microfone sem a supressão do Chromium e passa pelo RNNoise', async () => {
    await openMicrophone('mic-usb')
    expect(fake.getUserMedia).toHaveBeenCalledWith({
      audio: expect.objectContaining({ deviceId: { exact: 'mic-usb' }, noiseSuppression: false }),
      video: false
    })
    expect(gains()).toEqual([1, 0])
  })

  it('microfone estéreo vira mono antes do RNNoise', async () => {
    await openMicrophone()
    expect(node.instances[0]).toMatchObject({ channelCount: 1, channelCountMode: 'explicit' })
  })

  it('liga/desliga ao vivo sem trocar o stream enviado', async () => {
    const mic = await openMicrophone()
    const stream = mic.stream
    useNoiseSuppressionStore.getState().setEnabled(false)
    expect(gains()).toEqual([0, 1])
    useNoiseSuppressionStore.getState().setEnabled(true)
    expect(gains()).toEqual([1, 0])
    expect(mic.stream).toBe(stream)
    mic.stop()
  })

  it('stop() fecha o microfone de verdade, o RNNoise e o AudioContext', async () => {
    const raw = rawStream()
    fake.getUserMedia.mockResolvedValueOnce(raw)
    const mic = await openMicrophone()
    mic.stop()
    expect(raw.getTracks()[0].stop).toHaveBeenCalled()
    expect(node.instances[0].destroy).toHaveBeenCalled()
    expect(fake.contexts[0].close).toHaveBeenCalled()
    // Depois de fechado, o toggle não mexe mais nele.
    useNoiseSuppressionStore.getState().setEnabled(false)
    expect(gains()).toEqual([1, 0])
  })

  it('se o RNNoise não carrega: libera tudo e usa a supressão do Chromium', async () => {
    const raw = rawStream()
    fake.getUserMedia.mockResolvedValueOnce(raw)
    fake.addModule.mockRejectedValueOnce(new Error('CSP'))
    vi.spyOn(console, 'error').mockImplementation(() => {})

    const mic = await openMicrophone()

    expect(raw.getTracks()[0].stop).toHaveBeenCalled()
    expect(fake.contexts[0].close).toHaveBeenCalled()
    expect(fake.getUserMedia).toHaveBeenLastCalledWith({
      audio: expect.objectContaining({ noiseSuppression: true }),
      video: false
    })
    expect(useNoiseSuppressionStore.getState().available).toBe(false)
    mic.stop()
  })
})

describe('openMicrophone — detecção de fala no mesmo contexto', () => {
  beforeEach(() => {
    fake.contexts.length = 0
    FakeWorkletNode.instances.length = 0
    fake.addModule.mockReset().mockResolvedValue(undefined)
    fake.getUserMedia.mockReset().mockImplementation(async () => rawStream())
    useNoiseSuppressionStore.setState({ enabled: true, available: true })
  })

  it('liga o detector na soma wet+dry, sem abrir outro AudioContext', async () => {
    const mic = await openMicrophone()
    const changes: boolean[] = []
    const tap = mic.watchSpeaking!((s) => changes.push(s))
    await tap.ready

    expect(fake.contexts).toHaveLength(1)
    const ctx = fake.contexts[0] as unknown as FakeAudioContext
    const vad = FakeWorkletNode.instances[0]
    expect(vad.name).toBe('concord-voice-activity')
    expect(vad.ctx).toBe(ctx)
    const [wet, dry] = ctx.gains
    expect(wet.connect).toHaveBeenCalledWith(vad)
    expect(dry.connect).toHaveBeenCalledWith(vad)
    // Puxado pelo destino do próprio microfone (a saída do worklet é muda).
    expect(vad.connect).toHaveBeenCalledWith(ctx.destination)

    vad.port.onmessage!({ data: true })
    vad.port.onmessage!({ data: false })
    expect(changes).toEqual([true, false])
    mic.stop()
  })

  it('carrega o módulo uma vez por microfone; stop desliga e ignora o resto', async () => {
    const mic = await openMicrophone()
    const modulesBefore = fake.addModule.mock.calls.length
    const changes: boolean[] = []
    const first = mic.watchSpeaking!((s) => changes.push(s))
    await first.ready
    first.stop()
    const ctx = fake.contexts[0] as unknown as FakeAudioContext
    const vad = FakeWorkletNode.instances[0]
    expect(ctx.gains[0].disconnect).toHaveBeenCalledWith(vad)
    expect(ctx.gains[1].disconnect).toHaveBeenCalledWith(vad)
    expect(vad.disconnect).toHaveBeenCalled()
    expect(vad.port.close).toHaveBeenCalled()

    const second = mic.watchSpeaking!(() => {})
    await second.ready
    expect(fake.addModule.mock.calls.length - modulesBefore).toBe(1)
    expect(FakeWorkletNode.instances).toHaveLength(2)
    expect(changes).toEqual([])
    mic.stop()
  })

  it('parar antes do módulo carregar não cria o detector', async () => {
    const mic = await openMicrophone()
    const tap = mic.watchSpeaking!(() => {})
    tap.stop()
    await tap.ready
    expect(FakeWorkletNode.instances).toHaveLength(0)
    mic.stop()
  })

  it('worklet da detecção que não carrega: ready rejeita (quem chama volta ao servidor)', async () => {
    const mic = await openMicrophone()
    fake.addModule.mockRejectedValueOnce(new Error('CSP'))
    await expect(mic.watchSpeaking!(() => {}).ready).rejects.toThrow('CSP')
    mic.stop()
  })

  it('no fallback do Chromium não há detecção no contexto', async () => {
    fake.addModule.mockRejectedValueOnce(new Error('CSP'))
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const mic = await openMicrophone()
    expect(mic.watchSpeaking).toBeUndefined()
    mic.stop()
  })
})
