import { describe, expect, it } from 'vitest'
import {
  liveVisits,
  removeVisit,
  upsertVisit,
  visitOf,
  visitPath,
  visitServerOf
} from './guestVisits'

const NOW = Date.parse('2026-10-28T12:00:00Z')
type Visit = { server_id: string; channel_id: string; expires_at: string }
function pass(server: string, over: Record<string, unknown> = {}): Visit {
  const visit = {
    server_id: server,
    server_name: `Servidor ${server}`,
    channel_id: `voz-${server}`,
    channel_name: 'Sala',
    expires_at: '2026-10-28T14:00:00Z',
    can_speak: true,
    can_stream: false,
    ...over
  }
  return visit as Visit
}

describe('visitas de quem tem conta (trilho)', () => {
  it('caminho da visita e o servidor a partir do caminho', () => {
    expect(visitPath('abc')).toBe('/visitas/abc')
    expect(visitServerOf('/visitas/abc')).toBe('abc')
    expect(visitServerOf('/servers/abc')).toBeNull()
    expect(visitServerOf('/visitas/')).toBeNull()
  })

  it('upsert troca a visita do mesmo servidor (mover de canal) e acrescenta as novas', () => {
    const list = upsertVisit([pass('a')], pass('b'))
    expect(list.map((v) => v.server_id)).toEqual(['a', 'b'])
    const moved = upsertVisit(list, pass('a', { channel_id: 'outra' }))
    expect(moved.map((v) => v.channel_id)).toEqual(['outra', 'voz-b'])
  })

  it('remove some com a visita do servidor', () => {
    expect(removeVisit([pass('a'), pass('b')], 'a').map((v) => v.server_id)).toEqual(['b'])
  })

  it('só as que não venceram aparecem', () => {
    const list = [pass('a'), pass('b', { expires_at: '2026-10-28T11:59:00Z' })]
    expect(liveVisits(list, NOW).map((v) => v.server_id)).toEqual(['a'])
    expect(visitOf(list, 'a', NOW)?.server_id).toBe('a')
    expect(visitOf(list, 'b', NOW)).toBeNull()
    expect(visitOf(list, undefined, NOW)).toBeNull()
  })
})
