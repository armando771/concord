import { describe, expect, it } from 'vitest'
import { recordElapsed, recordStep, type RecordState } from './voiceRecord'

describe('gravação segurando o microfone', () => {
  const idle: RecordState = { phase: 'idle' }
  const press = recordStep(idle, { type: 'press', at: 1000 })

  it('apertar começa a gravar', () => {
    expect(press.action).toBe('start')
    expect(press.state).toEqual({ phase: 'recording', startedAt: 1000, inside: true })
  })
  it('soltar em cima do botão envia', () => {
    expect(recordStep(press.state, { type: 'release', at: 4000 })).toEqual({
      state: idle,
      action: 'send'
    })
  })
  it('toque rápido sem querer descarta', () => {
    expect(recordStep(press.state, { type: 'release', at: 1300 }).action).toBe('discard')
  })
  it('soltar fora do botão cancela; voltar para dentro reabilita', () => {
    const out = recordStep(press.state, { type: 'leave' })
    expect(recordStep(out.state, { type: 'release', at: 9000 }).action).toBe('cancel')
    const back = recordStep(out.state, { type: 'enter' })
    expect(recordStep(back.state, { type: 'release', at: 9000 }).action).toBe('send')
  })
  it('5 minutos envia sozinho', () => {
    expect(recordStep(press.state, { type: 'tick', at: 1000 + 299_999 }).action).toBeNull()
    expect(recordStep(press.state, { type: 'tick', at: 1000 + 300_000 })).toEqual({
      state: idle,
      action: 'send'
    })
  })
  it('eventos soltos com o botão parado não fazem nada', () => {
    expect(recordStep(idle, { type: 'release', at: 5 })).toEqual({ state: idle, action: null })
  })
  it('tempo decorrido', () => {
    expect(recordElapsed(press.state, 8000)).toBe(7000)
    expect(recordElapsed(idle, 8000)).toBe(0)
  })
})
