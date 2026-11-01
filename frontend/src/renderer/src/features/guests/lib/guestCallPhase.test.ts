import { describe, expect, it } from 'vitest'
import { guestCallPhase, passOfServer } from './guestCallPhase'

describe('fase da call do visitante', () => {
  it('na call, entrando ou saiu', () => {
    expect(guestCallPhase('active', false)).toBe('active')
    expect(guestCallPhase('idle', false)).toBe('connecting')
    expect(guestCallPhase('idle', true)).toBe('left')
    expect(guestCallPhase('outgoing', true)).toBe('connecting')
  })

  it('acha o acesso do servidor da call', () => {
    const passes = [
      { server_id: 'a', channel_id: '1' },
      { server_id: 'b', channel_id: '2' }
    ]
    expect(passOfServer(passes, 'b')?.channel_id).toBe('2')
    expect(passOfServer(passes, 'c')).toBeNull()
  })
})
