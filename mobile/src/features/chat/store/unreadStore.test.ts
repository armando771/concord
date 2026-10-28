import { useUnreadStore } from './unreadStore'

const state = () => useUnreadStore.getState()

describe('unreadStore (servidores e canais, só na sessão)', () => {
  beforeEach(() => useUnreadStore.setState(useUnreadStore.getInitialState(), true))

  it('add conta no canal e no servidor', () => {
    state().add('c1', 's1')
    state().add('c1', 's1')
    state().add('c2', 's1')
    expect(state().byChannel).toEqual({ c1: 2, c2: 1 })
    expect(state().byServer).toEqual({ s1: 3 })
  })

  it('mensagem sem servidor conhecido conta só no canal', () => {
    state().add('c1', null)
    expect(state().byChannel).toEqual({ c1: 1 })
    expect(state().byServer).toEqual({})
  })

  it('clearChannel zera o canal e desconta do servidor, sem passar de zero', () => {
    state().add('c1', 's1')
    state().add('c1', 's1')
    state().add('c2', 's1')
    state().clearChannel('c1', 's1')
    expect(state().byChannel.c1).toBeUndefined()
    expect(state().byServer.s1).toBe(1)
    state().clearChannel('c2', 's1')
    expect(state().byServer.s1).toBeUndefined()
  })

  it('clearChannel de canal sem não lida não mexe em nada', () => {
    state().add('c1', 's1')
    state().clearChannel('zzz', 's1')
    expect(state().byServer.s1).toBe(1)
  })

  it('reset limpa tudo (logout)', () => {
    state().add('c1', 's1')
    state().reset()
    expect(state().byChannel).toEqual({})
    expect(state().byServer).toEqual({})
  })
})
