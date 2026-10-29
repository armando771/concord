import { createPresenceReporter, type PresenceState } from './callPresence'

function rig(initial: PresenceState) {
  let state = initial
  const send = jest.fn()
  const reporter = createPresenceReporter({ read: () => state, send })
  return {
    send,
    reporter,
    set: (next: Partial<PresenceState>) => {
      state = { ...state, ...next }
      reporter.update()
    }
  }
}

describe('createPresenceReporter', () => {
  it('ao abrir o WS sem chamada avisa que não estou em nenhuma (null)', () => {
    const { send, reporter } = rig({ wsOpen: true, phase: 'idle', callId: null })
    reporter.opened()
    expect(send).toHaveBeenCalledWith(null)
  })

  it('com o WS fechado não manda nada', () => {
    const { send, reporter } = rig({ wsOpen: false, phase: 'idle', callId: null })
    reporter.opened()
    expect(send).not.toHaveBeenCalled()
  })

  it('tocando ou chamando ainda não dá para saber: espera', () => {
    const { send, reporter } = rig({ wsOpen: true, phase: 'ringing', callId: 'c1' })
    reporter.opened()
    expect(send).not.toHaveBeenCalled()
  })

  it('conectando, ativa e reconectando anunciam a chamada', () => {
    for (const phase of ['connecting', 'active', 'reconnecting'] as const) {
      const { send, reporter } = rig({ wsOpen: true, phase, callId: 'c1' })
      reporter.opened()
      expect(send).toHaveBeenCalledWith('c1')
    }
  })

  it('manda uma vez por conexão e de novo quando a chamada muda', () => {
    const { send, reporter, set } = rig({ wsOpen: true, phase: 'active', callId: 'c1' })
    reporter.opened()
    set({ phase: 'reconnecting' })
    expect(send).toHaveBeenCalledTimes(1)
    set({ phase: 'idle', callId: null })
    expect(send).toHaveBeenLastCalledWith(null)
    expect(send).toHaveBeenCalledTimes(2)
  })

  it('nova conexão do WS reenvia o mesmo estado', () => {
    const { send, reporter } = rig({ wsOpen: true, phase: 'active', callId: 'c1' })
    reporter.opened()
    reporter.opened()
    expect(send).toHaveBeenCalledTimes(2)
  })
})
