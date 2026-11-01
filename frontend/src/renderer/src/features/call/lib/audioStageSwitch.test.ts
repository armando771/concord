import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  fadeStart,
  STAGE_FADE_SECONDS,
  STAGE_LEAD_SECONDS,
  STAGE_TEARDOWN_MARGIN_MS,
  stageLead,
  switchStage,
  type AudioStage
} from './audioStageSwitch'

// Web Audio falso: guarda as ligações e a automação de cada ganho, para
// conferir a ordem (ligar → esperar → rampa; rampa → desligar).

type Event = [kind: 'set' | 'ramp', value: number, time: number]

class FakeParam {
  events: Event[] = []
  constructor(public value: number) {}
  setValueAtTime = (v: number, t: number): void => void this.events.push(['set', v, t])
  linearRampToValueAtTime = (v: number, t: number): void => void this.events.push(['ramp', v, t])
  /** Os eventos nunca voltam no tempo (nada é cancelado). */
  ordered = (): boolean => this.events.every((e, i) => i === 0 || e[2] >= this.events[i - 1][2])
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

const BASE_LATENCY = 0.01
const LEAD = STAGE_LEAD_SECONDS + BASE_LATENCY

function setup(warmupSeconds = 0.1): {
  ctx: { currentTime: number; baseLatency: number }
  source: FakeNode
  direct: FakeGain
  through: FakeGain
  created: FakeStage[]
  create: ReturnType<typeof vi.fn>
  stage: ReturnType<typeof switchStage<FakeStage>>
} {
  const ctx = { currentTime: 10, baseLatency: BASE_LATENCY }
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
const kinds = (events: Event[]): [string, number][] => events.map(([k, v]) => [k, v])

beforeEach(() => {
  vi.useFakeTimers()
})

afterEach(() => {
  vi.useRealTimers()
})

describe('fadeStart', () => {
  it('começa depois do que a thread de áudio já pode ter renderizado', () => {
    expect(stageLead({ currentTime: 0, baseLatency: 0.01 })).toBeCloseTo(0.01 + STAGE_LEAD_SECONDS)
    expect(stageLead({ currentTime: 0 })).toBe(STAGE_LEAD_SECONDS)
    expect(fadeStart({ currentTime: 5 }, 0, 0)).toBeCloseTo(5 + STAGE_LEAD_SECONDS)
  })

  it('nunca antes do fim da rampa anterior, e soma a espera da etapa nova', () => {
    expect(fadeStart({ currentTime: 5 }, 5.5, 0)).toBe(5.5)
    expect(fadeStart({ currentTime: 5 }, 5.5, 0.1)).toBeCloseTo(5.6)
  })
})

describe('switchStage', () => {
  it('a rampa fica entre 10 e 20 ms (sem estalo e sem demora)', () => {
    expect(STAGE_FADE_SECONDS).toBeGreaterThanOrEqual(0.01)
    expect(STAGE_FADE_SECONDS).toBeLessThanOrEqual(0.02)
  })

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
    const start = 10 + LEAD + 0.1
    expect(kinds(through.gain.events)).toEqual([
      ['set', 0],
      ['ramp', 1]
    ])
    expect(kinds(direct.gain.events)).toEqual([
      ['set', 1],
      ['ramp', 0]
    ])
    expect(through.gain.events[0][2]).toBeCloseTo(start)
    expect(through.gain.events[1][2]).toBeCloseTo(start + STAGE_FADE_SECONDS)
    expect(direct.gain.events[1][2]).toBeCloseTo(start + STAGE_FADE_SECONDS)
  })

  it('ao sair: cruza de volta e só desliga/destrói depois da rampa', () => {
    const { stage, ctx, source, through, direct, created } = setup()
    stage.set(true)
    ctx.currentTime = 20
    stage.set(false)
    expect(kinds(through.gain.events.slice(-2))).toEqual([
      ['set', 1],
      ['ramp', 0]
    ])
    expect(kinds(direct.gain.events.slice(-2))).toEqual([
      ['set', 0],
      ['ramp', 1]
    ])
    expect(through.gain.events.at(-2)![2]).toBeCloseTo(20 + LEAD)
    const [s] = created
    expect(s.destroy).not.toHaveBeenCalled()
    expect(source.outputs.has(node(s))).toBe(true)

    vi.advanceTimersByTime((LEAD + STAGE_FADE_SECONDS) * 1000)
    expect(s.destroy).not.toHaveBeenCalled()
    vi.advanceTimersByTime(STAGE_TEARDOWN_MARGIN_MS + 1)
    expect(s.destroy).toHaveBeenCalledOnce()
    expect(source.outputs.has(node(s))).toBe(false)
    expect(node(s).outputs.has(through)).toBe(false)
    expect(stage.current()).toBeNull()
  })

  it('inverter no meio de uma rampa espera ela acabar (nada é cancelado, sem salto)', () => {
    const { stage, ctx, through, direct } = setup(0.1)
    stage.set(true)
    // Ainda no aquecimento: a rampa de entrada está agendada no futuro.
    ctx.currentTime = 10.01
    stage.set(false)
    const enterEnd = 10 + LEAD + 0.1 + STAGE_FADE_SECONDS
    expect(through.gain.events.at(-2)![2]).toBeCloseTo(enterEnd)
    expect(through.gain.ordered()).toBe(true)
    expect(direct.gain.ordered()).toBe(true)
  })

  it('voltar antes de desmontar reaproveita a etapa (sem aquecer de novo)', () => {
    const { stage, ctx, through, created, create } = setup()
    stage.set(true)
    ctx.currentTime = 20
    stage.set(false)
    ctx.currentTime = 20.06
    stage.set(true)
    vi.advanceTimersByTime(1000)
    expect(create).toHaveBeenCalledOnce()
    expect(created[0].destroy).not.toHaveBeenCalled()
    expect(kinds(through.gain.events.slice(-2))).toEqual([
      ['set', 0],
      ['ramp', 1]
    ])
    expect(through.gain.events.at(-2)![2]).toBeCloseTo(20.06 + LEAD)
    expect(stage.current()).toBe(created[0])
  })

  it('depois de desmontada, entrar de novo cria uma etapa nova (estado limpo)', () => {
    const { stage, create, created } = setup()
    stage.set(true)
    stage.set(false)
    vi.advanceTimersByTime(1000)
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
    vi.advanceTimersByTime(1000)
    expect(created[0].destroy).toHaveBeenCalledOnce()
  })
})
