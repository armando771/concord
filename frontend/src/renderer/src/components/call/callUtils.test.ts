import { describe, expect, it } from 'vitest'
import { callRoute } from './callUtils'

describe('callRoute', () => {
  it('canal de voz vai para a rota do canal no servidor', () => {
    expect(callRoute({ type: 'channel', serverId: 's1', channelId: 'c1', peerId: null })).toBe(
      '/servers/s1/channels/c1'
    )
  })

  it('DM vai para a conversa com a pessoa', () => {
    expect(callRoute({ type: 'dm', serverId: null, channelId: null, peerId: 'ana' })).toBe(
      '/dm/ana'
    )
  })

  it('sem dados suficientes não há rota', () => {
    expect(callRoute({ type: 'channel', serverId: null, channelId: 'c1', peerId: null })).toBeNull()
    expect(callRoute({ type: null, serverId: null, channelId: null, peerId: null })).toBeNull()
  })
})
