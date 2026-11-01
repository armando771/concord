import { describe, expect, it } from 'vitest'
import { ADAPT, adaptTick, initialAdapt, type AdaptState } from './screenAdaptController'
import type { AdaptSample } from './screenAdaptSample'

const ok: AdaptSample = { limited: null, softwareCodec: null }
const bw: AdaptSample = { limited: 'bandwidth', softwareCodec: null }
const cpu: AdaptSample = { limited: 'cpu', softwareCodec: null }

/** Roda amostras e devolve o estado final. */
function run(state: AdaptState, samples: (AdaptSample | null)[], steps = 3): AdaptState {
  return samples.reduce((s, sample) => adaptTick(s, sample, steps), state)
}
const times = <T>(n: number, value: T): T[] => Array.from({ length: n }, () => value)
const ready = (): AdaptState => ({ ...initialAdapt(), hold: 0 })

describe('adaptTick', () => {
  it('começa esperando a rampa da banda antes de decidir', () => {
    const s = run(initialAdapt(), times(ADAPT.startHold + ADAPT.downAfter - 1, bw))
    expect(s.step).toBe(0)
  })

  it(`limitado por ${ADAPT.downAfter} leituras seguidas: desce um degrau e diz o motivo`, () => {
    expect(run(ready(), times(ADAPT.downAfter - 1, bw)).step).toBe(0)
    const s = run(ready(), times(ADAPT.downAfter, bw))
    expect(s.step).toBe(1)
    expect(s.reason).toBe('bandwidth')
  })

  it('uma leitura boa no meio zera a contagem (histerese)', () => {
    const s = run(ready(), [bw, bw, ok, bw, bw])
    expect(s.step).toBe(0)
  })

  it('depois de trocar, espera o encoder assentar antes de olhar de novo', () => {
    const s = run(ready(), [...times(ADAPT.downAfter, cpu), ...times(ADAPT.hold, cpu)])
    expect(s.step).toBe(1)
  })

  it('nunca passa do piso (último degrau)', () => {
    const s = run(ready(), times(100, cpu), 2)
    expect(s.step).toBe(1)
    expect(s.reason).toBe('cpu')
  })

  it(`folgado por ${ADAPT.upAfter} leituras: sobe de volta até o escolhido`, () => {
    const down = run(ready(), times(ADAPT.downAfter, bw))
    const almost = run(down, times(ADAPT.hold + ADAPT.upAfter - 1, ok))
    expect(almost.step).toBe(1)
    const up = adaptTick(almost, ok, 3)
    expect(up.step).toBe(0)
    expect(up.reason).toBeNull()
  })

  it('subiu e caiu logo: a próxima tentativa de subir espera o dobro', () => {
    const down = run(ready(), times(ADAPT.downAfter, bw))
    const up = run(down, times(ADAPT.hold + ADAPT.upAfter, ok))
    expect(up.step).toBe(0)
    const again = run(up, times(ADAPT.hold + ADAPT.downAfter, bw))
    expect(again.step).toBe(1)
    expect(again.upAfter).toBe(ADAPT.upAfter * 2)
  })

  it('envio pausado (sem amostra) não conta para nada', () => {
    const s = run(ready(), [bw, bw, null, null, bw])
    expect(s.step).toBe(1)
  })
})
