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
    disconnect = vi.fn()
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
    cancelAndHoldAtTime: () => void
    linearRampToValueAtTime: (v: number) => void
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
      },
      cancelAndHoldAtTime: () => {},
      linearRampToValueAtTime: (v) => {
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
    close: vi.fn(),
    postMessage: vi.fn()
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
  createMediaStreamSource = (): { connect: (n: unknown) => unknown; disconnect: () => void } => ({
    connect: (n) => n,
    disconnect: () => {}
  })
  createGain = (): FakeGain => {
    const g = fakeGain()
    this.gains.push(g)
    return g
  }
  createAnalyser = (): {
    fftSize: number
    connect: ReturnType<typeof vi.fn>
    getFloatTimeDomainData: (buf: Float32Array) => void
  } => ({
    fftSize: 2048,
    connect: vi.fn((next: unknown) => next),
    getFloatTimeDomainData: (buf) => buf.fill(0.5)
  })
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
const { useRnnoiseStatusStore } = await import('../store/rnnoiseStatusStore')
const { useVoiceAudioStore } = await import('../store/voiceAudioStore')
const { useVoiceModStore } = await import('../store/voiceModStore')

/** [wet, dry] do último contexto criado (os dois primeiros ganhos do grafo). */
const wetDry = (): number[] =>
  fake.contexts
    .at(-1)!
    .gains.slice(0, 2)
    .map((g) => g.gain.value)

describe('openMicrophone', () => {
  beforeEach(() => {
    fake.contexts.length = 0
    node.instances.length = 0
    fake.addModule.mockReset().mockResolvedValue(undefined)
    fake.getUserMedia.mockReset().mockImplementation(async () => rawStream())
    useNoiseSuppressionStore.setState({ enabled: true })
    useRnnoiseStatusStore.setState({ available: true })
  })

  it('abre o microfone sem a supressão do Chromium e passa pelo RNNoise', async () => {
    const mic = await openMicrophone('mic-usb')
    expect(fake.getUserMedia).toHaveBeenCalledWith({
      audio: expect.objectContaining({ deviceId: { exact: 'mic-usb' }, noiseSuppression: false }),
      video: false
    })
    expect(wetDry()).toEqual([1, 0])
    mic.stop()
  })

  it('com a supressão desligada o RNNoise nem é criado: o sinal passa direto', async () => {
    useNoiseSuppressionStore.setState({ enabled: false })
    const mic = await openMicrophone()
    expect(node.instances).toHaveLength(0)
    expect(wetDry()).toEqual([0, 1])
    mic.stop()
  })

  it('ligar no meio cria um RNNoise novo; desligar o destrói depois da rampa', async () => {
    vi.useFakeTimers()
    try {
      useNoiseSuppressionStore.setState({ enabled: false })
      const mic = await openMicrophone()
      useNoiseSuppressionStore.getState().setEnabled(true)
      expect(node.instances).toHaveLength(1)
      expect(wetDry()).toEqual([1, 0])
      useNoiseSuppressionStore.getState().setEnabled(false)
      expect(wetDry()).toEqual([0, 1])
      expect(node.instances[0].destroy).not.toHaveBeenCalled()
      vi.advanceTimersByTime(1000)
      expect(node.instances[0].destroy).toHaveBeenCalled()
      useNoiseSuppressionStore.getState().setEnabled(true)
      expect(node.instances).toHaveLength(2)
      mic.stop()
    } finally {
      vi.useRealTimers()
    }
  })

  it('microfone estéreo vira mono antes do RNNoise', async () => {
    const mic = await openMicrophone()
    expect(node.instances[0]).toMatchObject({ channelCount: 1, channelCountMode: 'explicit' })
    mic.stop()
  })

  it('liga/desliga ao vivo sem trocar o stream enviado', async () => {
    const mic = await openMicrophone()
    const stream = mic.stream
    useNoiseSuppressionStore.getState().setEnabled(false)
    expect(wetDry()).toEqual([0, 1])
    useNoiseSuppressionStore.getState().setEnabled(true)
    expect(wetDry()).toEqual([1, 0])
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
    expect(wetDry()).toEqual([1, 0])
  })

  it('fallback com a supressão desligada: sem supressão nenhuma (nem a do Chromium)', async () => {
    useNoiseSuppressionStore.setState({ enabled: false })
    fake.addModule.mockRejectedValueOnce(new Error('CSP'))
    vi.spyOn(console, 'error').mockImplementation(() => {})

    const mic = await openMicrophone()

    expect(fake.getUserMedia).toHaveBeenLastCalledWith({
      audio: expect.objectContaining({ noiseSuppression: false }),
      video: false
    })
    mic.stop()
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
    expect(useRnnoiseStatusStore.getState().available).toBe(false)
    mic.stop()
  })
})

describe('openMicrophone — detecção de fala, portão e volume de entrada', () => {
  beforeEach(() => {
    fake.contexts.length = 0
    FakeWorkletNode.instances.length = 0
    fake.addModule.mockReset().mockResolvedValue(undefined)
    fake.getUserMedia.mockReset().mockImplementation(async () => rawStream())
    useNoiseSuppressionStore.setState({ enabled: true })
    useRnnoiseStatusStore.setState({ available: true })
    useVoiceAudioStore.setState({ inputVolume: 1, detectionEnabled: true, sensitivity: 60 })
    // Módulos na ordem: RNNoise, detecção, voice mod. Sem o voice mod, a cauda é o ganho de entrada.
    fake.addModule
      .mockResolvedValueOnce(undefined)
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('sem voice mod'))
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  it('o detector fica no caminho do áudio, depois do ganho de entrada, sem outro AudioContext', async () => {
    const mic = await openMicrophone()
    expect(fake.contexts).toHaveLength(1)
    const ctx = fake.contexts[0] as unknown as FakeAudioContext
    const vad = FakeWorkletNode.instances[0]
    expect(vad.name).toBe('concord-voice-activity')
    expect(vad.ctx).toBe(ctx)
    const inputGain = ctx.gains[2]
    expect(inputGain.connect).toHaveBeenCalledWith(vad)
    // O que passa pelo portão é o que vai para o destino (o worklet é quem fecha o portão).
    expect(vad.connect).toHaveBeenCalledWith(ctx.destination)
    mic.stop()
  })

  it('com o voice mod no Normal o grafo dele nem é montado: o detector recebe o caminho direto', async () => {
    fake.addModule.mockReset().mockResolvedValue(undefined)
    useVoiceModStore.getState().selectPreset('normal')
    const mic = await openMicrophone()
    expect(useVoiceModStore.getState().available).toBe(true)
    expect(mic.setVoiceMod).toBeDefined()
    // Só o worklet da detecção existe (o do voice mod não foi criado).
    expect(FakeWorkletNode.instances.map((w) => w.name)).toEqual(['concord-voice-activity'])
    mic.stop()
  })

  it('sem o voice mod o microfone segue e o store marca indisponível', async () => {
    useVoiceModStore.setState({ available: true })
    const mic = await openMicrophone()
    expect(useVoiceModStore.getState().available).toBe(false)
    expect(mic.setVoiceMod).toBeUndefined()
    expect(mic.stream).toBeDefined()
    // O detector continua depois do ganho de entrada.
    const ctx = fake.contexts[0] as unknown as FakeAudioContext
    expect(ctx.gains[2].connect).toHaveBeenCalledWith(FakeWorkletNode.instances[0])
    mic.stop()
  })

  it('watchSpeaking recebe a fala e para de receber quando é parado', async () => {
    const mic = await openMicrophone()
    const vad = FakeWorkletNode.instances[0]
    const changes: boolean[] = []
    const tap = mic.watchSpeaking!((s) => changes.push(s))
    await tap.ready

    vad.port.onmessage!({ data: true })
    tap.stop()
    vad.port.onmessage!({ data: false })
    expect(changes).toEqual([true])
    mic.stop()
  })

  it('sem o worklet de detecção o microfone segue, sem portão nem watchSpeaking', async () => {
    fake.addModule
      .mockReset()
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('CSP'))
      .mockRejectedValueOnce(new Error('sem voice mod'))
    const mic = await openMicrophone()
    expect(mic.watchSpeaking).toBeUndefined()
    expect(mic.stream).toBeDefined()
    const ctx = fake.contexts[0] as unknown as FakeAudioContext
    expect(ctx.gains[2].connect).toHaveBeenCalledWith(ctx.destination)
    mic.stop()
  })

  it('volume de entrada e detecção/sensibilidade chegam ao grafo, ao vivo', async () => {
    useVoiceAudioStore.setState({ inputVolume: 1.5 })
    const mic = await openMicrophone()
    const ctx = fake.contexts[0] as unknown as FakeAudioContext
    const inputGain = ctx.gains[2]
    const vad = FakeWorkletNode.instances[0]
    expect(inputGain.gain.value).toBe(1.5)
    expect(vad.port.postMessage).toHaveBeenLastCalledWith({
      config: expect.objectContaining({ onDb: -40, offDb: -46 }),
      gate: true
    })

    useVoiceAudioStore.getState().setInputVolume(0.5)
    expect(inputGain.gain.value).toBe(0.5)

    useVoiceAudioStore.getState().setDetectionEnabled(false)
    expect(vad.port.postMessage).toHaveBeenLastCalledWith({
      config: expect.objectContaining({ onDb: -40 }),
      gate: false
    })

    useVoiceAudioStore.getState().setSensitivity(100)
    expect(vad.port.postMessage).toHaveBeenLastCalledWith({
      config: expect.objectContaining({ onDb: -60, offDb: -66 }),
      gate: false
    })
    mic.stop()
  })

  it('o medidor lê o nível em dBFS, antes do portão', async () => {
    const mic = await openMicrophone()
    // Amostras a 0,5 dão RMS de −6 dBFS.
    expect(mic.readLevel!()).toBeCloseTo(-6.02, 1)
    mic.stop()
  })

  it('no fallback do Chromium não há detecção no contexto', async () => {
    fake.addModule.mockReset().mockRejectedValueOnce(new Error('CSP'))
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const mic = await openMicrophone()
    expect(mic.watchSpeaking).toBeUndefined()
    mic.stop()
  })
})
