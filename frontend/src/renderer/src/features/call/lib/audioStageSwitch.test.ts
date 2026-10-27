import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  micStages,
  STAGE_FADE_SECONDS,
  STAGE_TEARDOWN_MS,
  switchStage,
  type AudioStage
} from './audioStageSwitch'

// Web Audio falso: guarda as ligações e a automação de cada ganho, para
// conferir a ordem (ligar → esperar → rampa; rampa → desligar).

type Event = [kind: string, value: number, time: number]

class FakeParam {
  events: Event[] = []
  constructor(public value: number) {}
  cancelAndHoldAtTime = (t: number): void => void this.events.push(['hold', this.value, t])
  setValueAtTime = (v: number, t: number): void => void this.events.push(['set', v, t])
  linearRampToValueAtTime = (v: number, t: number): void => {
    this.events.push(['ramp', v, t])
    this.value = v
  }
}

class FakeNode {
  outputs = new Set<FakeNode>()
  constructor(public name: string) {}
  connect = (next: FakeNode): FakeNode => {
    this.outputs.add(next)
    return next
  }
  disconnect = (next?: FakeNode): void => {
    if (next) this.outputs.delete(next)
    else this.outputs.clear()
  }
}

class FakeGain extends FakeNode {
  gain: FakeParam
  constructor(name: string, value: number) {
    super(name)
    this.gain = new FakeParam(value)
  }
}

interface FakeStage extends AudioStage {
  destroy: ReturnType<typeof vi.fn>
}

function setup(warmupSeconds = 0.1): {
  ctx: { currentTime: number }
  source: FakeNode
  direct: FakeGain
  through: FakeGain
  created: FakeStage[]
  create: ReturnType<typeof vi.fn>
  stage: ReturnType<typeof switchStage<FakeStage>>
} {
  const ctx = { currentTime: 10 }
  const source = new FakeNode('source')
  const direct = new FakeGain('direct', 1)
  const through = new FakeGain('through', 0)
  const created: FakeStage[] = []
  const create = vi.fn((): FakeStage => {
    const node = new FakeNode(`stage${created.length}`)
    const stage = { input: node, output: node, destroy: vi.fn() } as unknown as FakeStage
    created.push(stage)
    return stage
  })
  const stage = switchStage<FakeStage>({
    ctx,
    source: source as unknown as AudioNode,
    direct: direct as unknown as GainNode,
    through: through as unknown as GainNode,
    create,
    warmupSeconds
  })
  return { ctx, source, direct, through, created, create, stage }
}

const node = (stage: AudioStage): FakeNode => stage.input as unknown as FakeNode

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('micStages', () => {
  it('cada etapa só entra no grafo quando faz algo', () => {
    expect(micStages({ voiceModActive: false, noiseSuppression: false })).toEqual({
      rnnoise: false,
      voiceMod: false
    })
    expect(micStages({ voiceModActive: true, noiseSuppression: false })).toEqual({
      rnnoise: false,
      voiceMod: true
    })
    expect(micStages({ voiceModActive: false, noiseSuppression: true })).toEqual({
      rnnoise: true,
      voiceMod: false
    })
  })
})

describe('switchStage', () => {
  it('desligada não cria nada: o sinal só passa pelo caminho direto', () => {
    const { stage, create } = setup()
    stage.set(false)
    expect(create).not.toHaveBeenCalled()
    expect(stage.current()).toBeNull()
  })

  it('ao entrar: liga a etapa com o ganho dela em 0, espera o aquecimento e cruza', () => {
    const { stage, source, through, direct, created } = setup(0.1)
    stage.set(true)
    const [s] = created
    expect(source.outputs.has(node(s))).toBe(true)
    expect(node(s).outputs.has(through)).toBe(true)
    const start = 10 + 0.1
    const end = start + STAGE_FADE_SECONDS
    // Segura o valor atual até o aquecimento acabar, depois rampa linear curta.
    expect(through.gain.events).toEqual([
      ['hold', 0, 10],
      ['set', 0, start],
      ['ramp', 1, end]
    ])
    expect(direct.gain.events).toEqual([
      ['hold', 1, 10],
      ['set', 1, start],
      ['ramp', 0, end]
    ])
  })

  it('a rampa fica entre 10 e 20 ms (sem estalo e sem demora)', () => {
    expect(STAGE_FADE_SECONDS).toBeGreaterThanOrEqual(0.01)
    expect(STAGE_FADE_SECONDS).toBeLessThanOrEqual(0.02)
  })

  it('ao sair: cruza de volta na hora e só desliga/destrói depois da rampa', () => {
    const { stage, ctx, source, through, direct, created } = setup()
    stage.set(true)
    ctx.currentTime = 20
    stage.set(false)
    expect(through.gain.events.slice(-2)).toEqual([
      ['hold', 1, 20],
      ['ramp', 0, 20 + STAGE_FADE_SECONDS]
    ])
    expect(direct.gain.events.slice(-2)).toEqual([
      ['hold', 0, 20],
      ['ramp', 1, 20 + STAGE_FADE_SECONDS]
    ])
    const [s] = created
    expect(s.destroy).not.toHaveBeenCalled()
    expect(source.outputs.has(node(s))).toBe(true)

    vi.advanceTimersByTime(STAGE_TEARDOWN_MS)
    expect(STAGE_TEARDOWN_MS).toBeGreaterThan(STAGE_FADE_SECONDS * 1000)
    expect(s.destroy).toHaveBeenCalledOnce()
    expect(source.outputs.has(node(s))).toBe(false)
    expect(node(s).outputs.has(through)).toBe(false)
    expect(stage.current()).toBeNull()
  })

  it('voltar antes de desmontar reaproveita a etapa (sem aquecer de novo)', () => {
    const { stage, ctx, through, created, create } = setup()
    stage.set(true)
    ctx.currentTime = 20
    stage.set(false)
    ctx.currentTime = 20.005
    stage.set(true)
    vi.advanceTimersByTime(STAGE_TEARDOWN_MS * 2)
    expect(create).toHaveBeenCalledOnce()
    expect(created[0].destroy).not.toHaveBeenCalled()
    expect(through.gain.events.slice(-2)).toEqual([
      ['hold', 0, 20.005],
      ['ramp', 1, 20.005 + STAGE_FADE_SECONDS]
    ])
    expect(stage.current()).toBe(created[0])
  })

  it('depois de desmontada, entrar de novo cria uma etapa nova (estado limpo)', () => {
    const { stage, create, created } = setup()
    stage.set(true)
    stage.set(false)
    vi.advanceTimersByTime(STAGE_TEARDOWN_MS)
    stage.set(true)
    expect(create).toHaveBeenCalledTimes(2)
    expect(stage.current()).toBe(created[1])
  })

  it('pedir o mesmo estado de novo não mexe nos ganhos', () => {
    const { stage, through } = setup()
    stage.set(true)
    const events = through.gain.events.length
    stage.set(true)
    expect(through.gain.events).toHaveLength(events)
  })

  it('se a etapa não puder ser criada, fica fora do grafo', () => {
    const { stage, through, create } = setup()
    create.mockReturnValueOnce(null)
    stage.set(true)
    expect(stage.current()).toBeNull()
    expect(through.gain.events).toEqual([])
    // E tenta de novo no próximo pedido.
    stage.set(false)
    stage.set(true)
    expect(stage.current()).not.toBeNull()
  })

  it('destroy desmonta na hora e cancela a desmontagem pendente', () => {
    const { stage, created, source } = setup()
    stage.set(true)
    stage.set(false)
    stage.destroy()
    expect(created[0].destroy).toHaveBeenCalledOnce()
    expect(source.outputs.size).toBe(0)
    vi.advanceTimersByTime(STAGE_TEARDOWN_MS)
    expect(created[0].destroy).toHaveBeenCalledOnce()
  })

  it('sem cancelAndHoldAtTime (Firefox): segura o valor com cancel + set', () => {
    const { stage, through } = setup()
    const param = through.gain as unknown as Record<string, unknown>
    delete param.cancelAndHoldAtTime
    const calls: Event[] = []
    param.cancelScheduledValues = (t: number): void => void calls.push(['cancel', 0, t])
    const set = through.gain.setValueAtTime
    param.setValueAtTime = (v: number, t: number): void => {
      calls.push(['set', v, t])
      set(v, t)
    }
    stage.set(true)
    expect(calls.slice(0, 2)).toEqual([
      ['cancel', 0, 10],
      ['set', 0, 10]
    ])
  })
})
