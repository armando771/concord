import { bindRealtimeLifecycle } from './realtimeLifecycle'

function sources() {
  let appHandler: (state: string) => void = () => {}
  let netHandler: (state: { isConnected: boolean | null }) => void = () => {}
  const removeApp = jest.fn()
  const removeNet = jest.fn()
  return {
    appState: { addEventListener: (_: 'change', h: typeof appHandler) => ((appHandler = h), { remove: removeApp }) },
    netInfo: { addEventListener: (h: typeof netHandler) => ((netHandler = h), removeNet) },
    emitApp: (s: string) => appHandler(s),
    emitNet: (c: boolean | null) => netHandler({ isConnected: c }),
    removeApp,
    removeNet
  }
}

describe('bindRealtimeLifecycle', () => {
  it('ao voltar do segundo plano (active), tenta reconectar agora', () => {
    const s = sources()
    const client = { retryNow: jest.fn() }
    bindRealtimeLifecycle(client, s.appState, s.netInfo)
    s.emitApp('background')
    expect(client.retryNow).not.toHaveBeenCalled()
    s.emitApp('active')
    expect(client.retryNow).toHaveBeenCalledTimes(1)
  })

  it('ao voltar a rede, tenta reconectar agora; sem rede, não', () => {
    const s = sources()
    const client = { retryNow: jest.fn() }
    bindRealtimeLifecycle(client, s.appState, s.netInfo)
    s.emitNet(false)
    s.emitNet(null)
    expect(client.retryNow).not.toHaveBeenCalled()
    s.emitNet(true)
    expect(client.retryNow).toHaveBeenCalledTimes(1)
  })

  it('o desligar remove os dois ouvintes', () => {
    const s = sources()
    const stop = bindRealtimeLifecycle({ retryNow: jest.fn() }, s.appState, s.netInfo)
    stop()
    expect(s.removeApp).toHaveBeenCalled()
    expect(s.removeNet).toHaveBeenCalled()
  })
})
