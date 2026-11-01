import { describe, expect, it } from 'vitest'
import { callRoute, formatDuration } from './callUtils'

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

describe('formatDuration', () => {
  it('minutos e segundos', () => {
    expect(formatDuration(0)).toBe('00:00')
    expect(formatDuration(309)).toBe('05:09')
    expect(formatDuration(3599)).toBe('59:59')
  })

  it('a partir de 1 hora mostra as horas', () => {
    expect(formatDuration(3600)).toBe('1:00:00')
    expect(formatDuration(3909)).toBe('1:05:09')
    expect(formatDuration(26 * 3600 + 61)).toBe('26:01:01')
  })
})
