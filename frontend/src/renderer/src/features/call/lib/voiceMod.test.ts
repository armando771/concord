import { describe, expect, it, vi } from 'vitest'
import { VOICE_MOD_PRESETS, type VoiceModPreset, type VoiceModSettings } from './voiceModPresets'

// Web Audio falso: só guarda os valores e as ligações, para conferir o grafo.

class FakeParam {
  constructor(public value = 0) {}
  cancelScheduledValues = (): void => {}
  setValueAtTime = (v: number): void => void (this.value = v)
  setTargetAtTime = (v: number): void => void (this.value = v)
  cancelAndHoldAtTime = (): void => {}
  linearRampToValueAtTime = (v: number): void => void (this.value = v)
}

class FakeNode {
  outputs: FakeNode[] = []
  connect = (next: FakeNode): FakeNode => {
    this.outputs.push(next)
    return next
  }
  disconnect = vi.fn()
  constructor(public kind: string) {}
}

class FakeGain extends FakeNode {
  gain = new FakeParam(1)
  channelCount = 2
  channelCountMode = 'max'
}

class FakeBiquad extends FakeNode {
  type = 'lowpass'
  frequency = new FakeParam(350)
  gain = new FakeParam(0)
}

class FakeShaper extends FakeNode {
  curve: Float32Array | null = null
}

class FakeConvolver extends FakeNode {
  normalize = true
  buffer: { length: number } | null = null
}

class FakeWorklet extends FakeNode {
  port = { postMessage: vi.fn() }
  options: AudioWorkletNodeOptions | undefined
}
vi.stubGlobal(
  'AudioWorkletNode',
  class extends FakeWorklet {
    constructor(ctx: FakeContext, _name: string, options?: AudioWorkletNodeOptions) {
      super('worklet')
      this.options = options
      ctx.nodes.push(this)
    }
  }
)

class FakeContext {
  currentTime = 0
  sampleRate = 48_000
  audioWorklet = { addModule: vi.fn(async () => {}) }
  nodes: FakeNode[] = []
  private track<T extends FakeNode>(node: T): T {
    this.nodes.push(node)
    return node
  }
  createGain = (): FakeGain => this.track(new FakeGain('gain'))
  createDelay = (): FakeNode & { delayTime: FakeParam } =>
    this.track(Object.assign(new FakeNode('delay'), { delayTime: new FakeParam() }))
  createBiquadFilter = (): FakeBiquad => this.track(new FakeBiquad('biquad'))
  createWaveShaper = (): FakeShaper => this.track(new FakeShaper('shaper'))
  createConvolver = (): FakeConvolver => this.track(new FakeConvolver('convolver'))
  createBuffer = (
    _: number,
    length: number
  ): { length: number; getChannelData: () => Float32Array } => {
    const data = new Float32Array(length)
    return { length, getChannelData: () => data }
  }
}

const { loadVoiceMod } = await import('./voiceMod')
const { VOICE_MOD_STOP } = await import('./voiceModDsp')

type Mod = ReturnType<Awaited<ReturnType<typeof loadVoiceMod>>>

async function build(): Promise<{ ctx: FakeContext; mod: Mod }> {
  const ctx = new FakeContext()
  const create = await loadVoiceMod(ctx as unknown as AudioContext)
  return { ctx, mod: create() }
}

function preset(id: VoiceModPreset): VoiceModSettings {
  return { preset: id, customized: false, ...VOICE_MOD_PRESETS[id].values }
}

/** Todo nó que chega à saída por algum caminho. */
function reachesOutput(from: FakeNode, output: FakeNode, seen = new Set<FakeNode>()): boolean {
  if (from === output) return true
  if (seen.has(from)) return false
  seen.add(from)
  return from.outputs.some((next) => reachesOutput(next, output, seen))
}

/** Ganhos direto (bypass), seco e processado, achados pelas ligações. */
function mainGains(ctx: FakeContext, mod: Mod): { bypass: FakeGain; dry: FakeGain; wet: FakeGain } {
  const input = mod.input as unknown as FakeNode
  const output = mod.output as unknown as FakeNode
  const gains = ctx.nodes.filter((n): n is FakeGain => n.kind === 'gain')
  const limiter = ctx.nodes.find((n) => n.kind === 'shaper' && n.outputs.includes(output))!
  return {
    bypass: gains.find((g) => input.outputs.includes(g) && g.outputs.includes(output))!,
    dry: gains.find(
      (g) => g !== input && !input.outputs.includes(g) && g.outputs.includes(output)
    )!,
    wet: gains.find((g) => g.outputs.includes(limiter))!
  }
}

describe('loadVoiceMod', () => {
  it('carregar só registra o worklet: nenhum nó existe até a voz ser usada', async () => {
    const ctx = new FakeContext()
    const create = await loadVoiceMod(ctx as unknown as AudioContext)
    expect(ctx.audioWorklet.addModule).toHaveBeenCalledOnce()
    expect(ctx.nodes).toHaveLength(0)
    create()
    create()
    expect(ctx.audioWorklet.addModule).toHaveBeenCalledOnce()
    expect(ctx.nodes.filter((n) => n.kind === 'worklet')).toHaveLength(2)
  })

  it('todo nó criado chega à saída (nada fica pendurado)', async () => {
    const { ctx, mod } = await build()
    const output = mod.output as unknown as FakeNode
    for (const node of ctx.nodes) expect(reachesOutput(node, output), node.kind).toBe(true)
  })

  it('o worklet recebe o DSP em WASM já compilado (sem recompilar por microfone)', async () => {
    const { ctx } = await build()
    const { ctx: other } = await build()
    const options = (c: FakeContext): AudioWorkletNodeOptions | undefined =>
      c.nodes.find((n): n is FakeWorklet => n.kind === 'worklet')!.options
    const module = options(ctx)?.processorOptions?.dspModule
    expect(module).toBeInstanceOf(WebAssembly.Module)
    expect(options(other)?.processorOptions?.dspModule).toBe(module)
  })

  it('o reverb usa um impulso próprio, sem a normalização do navegador', async () => {
    const { ctx } = await build()
    const convolver = ctx.nodes.find((n): n is FakeConvolver => n.kind === 'convolver')!
    expect(convolver.normalize).toBe(false)
    expect(convolver.buffer!.length).toBeGreaterThan(ctx.sampleRate)
  })

  it('Normal: só o caminho direto; seco e processado ficam mudos', async () => {
    const { ctx, mod } = await build()
    mod.apply(preset('normal'), true)
    const { bypass, dry, wet } = mainGains(ctx, mod)
    expect([bypass, dry, wet].map((g) => g.gain.value)).toEqual([1, 0, 0])
  })

  it('preset com efeito: desliga o direto e abre o processado', async () => {
    const { ctx, mod } = await build()
    mod.apply({ ...preset('grave'), intensity: 0.5 }, true)
    const { bypass, dry, wet } = mainGains(ctx, mod)
    expect(bypass.gain.value).toBe(0)
    expect(dry.gain.value).toBeCloseTo(0.5, 5)
    // O processado entra no limitador com headroom: metade do nível.
    expect(wet.gain.value).toBeCloseTo(0.25, 5)
  })

  it('cada preset vira valores nos nós e uma mensagem ao worklet', async () => {
    const { ctx, mod } = await build()
    const shaper = ctx.nodes.filter((n): n is FakeShaper => n.kind === 'shaper')
    const worklet = ctx.nodes.find((n): n is FakeWorklet => n.kind === 'worklet')!

    mod.apply(preset('megafone'), true)
    const [drive, limiter] = shaper
    expect(drive.curve).not.toBeNull()
    expect(limiter.curve).not.toBeNull()
    const filters = ctx.nodes.filter((n): n is FakeBiquad => n.kind === 'biquad')
    expect(filters.map((f) => f.frequency.value)).toContain(
      VOICE_MOD_PRESETS.megafone.effect.highpassHz
    )

    mod.apply(preset('alien'), false)
    expect(drive.curve).toBeNull()
    expect(worklet.port.postMessage).toHaveBeenLastCalledWith({
      ratio: 2 ** (VOICE_MOD_PRESETS.alien.values.pitch / 12),
      modHz: VOICE_MOD_PRESETS.alien.effect.modHz,
      modDepth: VOICE_MOD_PRESETS.alien.effect.modDepth,
      vibratoHz: VOICE_MOD_PRESETS.alien.effect.vibratoHz,
      vibratoSemitones: VOICE_MOD_PRESETS.alien.effect.vibratoSemitones
    })
  })

  it('reverb só recebe sinal nos presets com reverb', async () => {
    const { ctx, mod } = await build()
    const convolver = ctx.nodes.find((n) => n.kind === 'convolver')!
    const send = ctx.nodes.find(
      (n): n is FakeGain => n.kind === 'gain' && n.outputs.includes(convolver)
    )!
    mod.apply(preset('caverna'), true)
    expect(send.gain.value).toBe(VOICE_MOD_PRESETS.caverna.effect.reverb)
    mod.apply(preset('robo'), true)
    expect(send.gain.value).toBe(0)
  })

  it('destroy desliga todos os nós e para o worklet de vez', async () => {
    const { ctx, mod } = await build()
    mod.destroy()
    for (const node of ctx.nodes) expect(node.disconnect, node.kind).toHaveBeenCalled()
    const worklet = ctx.nodes.find((n): n is FakeWorklet => n.kind === 'worklet')!
    expect(worklet.port.postMessage).toHaveBeenLastCalledWith(VOICE_MOD_STOP)
  })
})

const { voiceModPath } = await import('./voiceMod')

async function path(initial: VoiceModSettings): Promise<{
  voice: ReturnType<typeof voiceModPath>
  worklets: () => FakeWorklet[]
}> {
  const ctx = new FakeContext()
  const create = await loadVoiceMod(ctx as unknown as AudioContext)
  const input = ctx.createGain() as unknown as AudioNode
  const voice = voiceModPath(ctx as unknown as AudioContext, input, create, initial)
  const worklets = (): FakeWorklet[] =>
    ctx.nodes.filter((n): n is FakeWorklet => n.kind === 'worklet')
  return { voice, worklets }
}

describe('voiceModPath', () => {
  it('no Normal o voice mod nem existe: o sinal vai direto para a saída', async () => {
    const { worklets } = await path(preset('normal'))
    expect(worklets()).toHaveLength(0)
  })

  it('escolher uma voz monta o grafo já com ela; voltar ao Normal destrói depois da rampa', async () => {
    vi.useFakeTimers()
    try {
      const { voice, worklets } = await path(preset('normal'))
      voice.apply(preset('esquilo'))
      const [shifter] = worklets()
      expect(shifter.port.postMessage).toHaveBeenLastCalledWith(
        expect.objectContaining({ ratio: 2 ** (VOICE_MOD_PRESETS.esquilo.values.pitch / 12) })
      )
      voice.apply(preset('robo'))
      expect(worklets()).toHaveLength(1)
      expect(shifter.port.postMessage).toHaveBeenLastCalledWith(
        expect.objectContaining({ modHz: VOICE_MOD_PRESETS.robo.effect.modHz })
      )

      voice.apply(preset('normal'))
      expect(shifter.port.postMessage).not.toHaveBeenLastCalledWith(VOICE_MOD_STOP)
      vi.advanceTimersByTime(1000)
      expect(shifter.port.postMessage).toHaveBeenLastCalledWith(VOICE_MOD_STOP)
    } finally {
      vi.useRealTimers()
    }
  })

  it('abrir o microfone já numa voz monta o grafo na hora', async () => {
    const { worklets } = await path(preset('grave'))
    expect(worklets()).toHaveLength(1)
  })

  it('se o grafo não monta, o microfone segue sem a voz (direto)', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    const ctx = new FakeContext()
    const input = ctx.createGain() as unknown as AudioNode
    const broken = (): never => {
      throw new Error('sem worklet')
    }
    const voice = voiceModPath(ctx as unknown as AudioContext, input, broken, preset('grave'))
    expect(() => voice.apply(preset('esquilo'))).not.toThrow()
    expect(console.error).toHaveBeenCalled()
  })
})
