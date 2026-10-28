import { useSelectedServerStore } from './selectedServerStore'

const reset = () => useSelectedServerStore.setState(useSelectedServerStore.getInitialState(), true)

describe('selectedServerStore', () => {
  beforeEach(reset)

  it('começa nas DMs (nenhum servidor)', () => {
    expect(useSelectedServerStore.getState().serverId).toBeNull()
  })

  it('select troca o servidor; null volta às DMs', () => {
    useSelectedServerStore.getState().select('s1')
    expect(useSelectedServerStore.getState().serverId).toBe('s1')
    useSelectedServerStore.getState().select(null)
    expect(useSelectedServerStore.getState().serverId).toBeNull()
  })

  it('ensureSelection escolhe o primeiro servidor quando não há escolha', () => {
    useSelectedServerStore.getState().ensureSelection(['a', 'b'])
    expect(useSelectedServerStore.getState().serverId).toBe('a')
  })

  it('ensureSelection mantém a escolha que ainda existe', () => {
    useSelectedServerStore.getState().select('b')
    useSelectedServerStore.getState().ensureSelection(['a', 'b'])
    expect(useSelectedServerStore.getState().serverId).toBe('b')
  })

  it('ensureSelection troca a escolha de um servidor que sumiu (saiu/foi removido)', () => {
    useSelectedServerStore.getState().select('x')
    useSelectedServerStore.getState().ensureSelection(['a'])
    expect(useSelectedServerStore.getState().serverId).toBe('a')
  })

  it('sem servidores: fica nas DMs', () => {
    useSelectedServerStore.getState().select('x')
    useSelectedServerStore.getState().ensureSelection([])
    expect(useSelectedServerStore.getState().serverId).toBeNull()
  })
})
