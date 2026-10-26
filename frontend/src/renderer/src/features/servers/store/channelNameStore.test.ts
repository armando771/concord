import { beforeEach, describe, expect, it } from 'vitest'
import { CHANNEL_NAMES_TTL_MS, channelNamesStale, useChannelNameStore } from './channelNameStore'

const store = (): ReturnType<typeof useChannelNameStore.getState> => useChannelNameStore.getState()

describe('channelNameStore', () => {
  beforeEach(() => store().reset())

  it('guarda os nomes dos canais de um servidor', () => {
    store().learn('s1', [{ id: 'c1', name: 'Geral' }], 1000)
    expect(store().nameOf('s1', 'c1')).toBe('Geral')
    expect(store().nameOf('s2', 'c1')).toBeNull()
  })

  it('a lista nova substitui a antiga: renomeado muda, apagado some', () => {
    store().learn(
      's1',
      [
        { id: 'c1', name: 'Geral' },
        { id: 'c2', name: 'Velho' }
      ],
      1000
    )
    store().learn('s1', [{ id: 'c1', name: 'Papo' }], 2000)
    expect(store().nameOf('s1', 'c1')).toBe('Papo')
    expect(store().nameOf('s1', 'c2')).toBeNull()
  })

  it('evento de canal do servidor invalida a lista (busca de novo)', () => {
    store().learn('s1', [{ id: 'c1', name: 'Geral' }], 1000)
    expect(channelNamesStale(store().fetchedAt.s1, 1000)).toBe(false)
    store().invalidate('s1')
    expect(channelNamesStale(store().fetchedAt.s1, 1000)).toBe(true)
    // o nome antigo continua até chegar o novo
    expect(store().nameOf('s1', 'c1')).toBe('Geral')
  })

  it('reset (logout) esquece tudo', () => {
    store().learn('s1', [{ id: 'c1', name: 'Geral' }], 1000)
    store().reset()
    expect(store().nameOf('s1', 'c1')).toBeNull()
  })
})

describe('channelNamesStale', () => {
  it('nunca buscado está velho', () => {
    expect(channelNamesStale(undefined, 0)).toBe(true)
  })

  it('expira depois do TTL', () => {
    expect(channelNamesStale(1000, 1000 + CHANNEL_NAMES_TTL_MS - 1)).toBe(false)
    expect(channelNamesStale(1000, 1000 + CHANNEL_NAMES_TTL_MS)).toBe(true)
  })
})
