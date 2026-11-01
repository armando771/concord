import { describe, expect, it, vi } from 'vitest'
import { createPresenceReporter, type PresenceState } from './callPresence'

function fixture(initial: Partial<PresenceState> = {}): {
  state: PresenceState
  send: ReturnType<typeof vi.fn>
  reporter: ReturnType<typeof createPresenceReporter>
} {
  const state: PresenceState = {
    wsOpen: true,
    resumeSettled: true,
    status: 'idle',
    callId: null,
    ...initial
  }
  const send = vi.fn()
  return { state, send, reporter: createPresenceReporter({ read: () => state, send }) }
}

describe('presença na call (#374)', () => {
  it('app reaberto sem retomar: avisa que não está em call ao conectar', () => {
    const { send, reporter } = fixture()
    reporter.opened()
    expect(send).toHaveBeenCalledExactlyOnceWith(null)
  })

  it('não diz "não estou" enquanto a retomada não decidiu', () => {
    const { state, send, reporter } = fixture({ resumeSettled: false })
    reporter.opened()
    expect(send).not.toHaveBeenCalled()
    // Retomou: diz a call, nunca "não estou".
    state.status = 'active'
    state.callId = 'call-1'
    state.resumeSettled = true
    reporter.update()
    expect(send).toHaveBeenCalledExactlyOnceWith('call-1')
  })

  it('retomada desistiu: avisa que não está em call', () => {
    const { state, send, reporter } = fixture({ resumeSettled: false })
    reporter.opened()
    state.resumeSettled = true
    reporter.update()
    expect(send).toHaveBeenCalledExactlyOnceWith(null)
  })

  it('não repete na mesma conexão; repete a cada reconexão', () => {
    const { send, reporter } = fixture({ status: 'active', callId: 'call-1' })
    reporter.opened()
    reporter.update()
    reporter.opened()
    expect(send.mock.calls).toEqual([['call-1'], ['call-1']])
  })

  it('WS fechado: não manda nada', () => {
    const { send, reporter } = fixture({ wsOpen: false })
    reporter.update()
    expect(send).not.toHaveBeenCalled()
  })

  it('tocando ou chamando: ainda não sabe, não manda nada', () => {
    const { state, send, reporter } = fixture({ status: 'outgoing', callId: 'call-1' })
    reporter.opened()
    state.status = 'ringing'
    reporter.update()
    expect(send).not.toHaveBeenCalled()
  })

  it('saiu da call: avisa', () => {
    const { state, send, reporter } = fixture({ status: 'active', callId: 'call-1' })
    reporter.opened()
    state.status = 'idle'
    state.callId = null
    reporter.update()
    expect(send.mock.calls).toEqual([['call-1'], [null]])
  })
})
