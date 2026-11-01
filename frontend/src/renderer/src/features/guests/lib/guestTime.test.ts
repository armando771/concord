import { describe, expect, it } from 'vitest'
import { expired, timeLeftLabel } from './guestTime'

const now = Date.parse('2026-10-28T12:00:00Z')
const at = (min: number): string => new Date(now + min * 60_000).toISOString()

describe('tempo de acesso do visitante', () => {
  it('fala o tempo que falta', () => {
    expect(timeLeftLabel(at(0.5), now)).toBe('menos de 1 min')
    expect(timeLeftLabel(at(12), now)).toBe('12 min')
    expect(timeLeftLabel(at(120), now)).toBe('2 h')
    expect(timeLeftLabel(at(320), now)).toBe('5 h 20 min')
    expect(timeLeftLabel(at(24 * 60), now)).toBe('1 dia')
  })

  it('sabe quando acabou', () => {
    expect(expired(at(0), now)).toBe(true)
    expect(expired(at(1), now)).toBe(false)
  })
})
