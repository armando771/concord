import { describe, expect, it } from 'vitest'
import { birthdayError, birthdayModalKey, birthYears, daysInMonth } from './birthday'

const NOW = new Date(2026, 9, 25, 12)

describe('daysInMonth', () => {
  it('fevereiro: 29 sem ano ou em ano bissexto, 28 nos outros', () => {
    expect(daysInMonth(2)).toBe(29)
    expect(daysInMonth(2, 2004)).toBe(29)
    expect(daysInMonth(2, 2001)).toBe(28)
    expect(daysInMonth(4)).toBe(30)
    expect(daysInMonth(null)).toBe(31)
  })
})

describe('birthYears', () => {
  it('do ano atual até 1900', () => {
    const years = birthYears(NOW)
    expect(years[0]).toBe(2026)
    expect(years[years.length - 1]).toBe(1900)
  })
})

describe('birthdayError', () => {
  it('tudo vazio ou uma data válida pode salvar', () => {
    expect(birthdayError({ day: null, month: null, year: null }, NOW)).toBeNull()
    expect(birthdayError({ day: 29, month: 2, year: 2004 }, NOW)).toBeNull()
    expect(birthdayError({ day: 25, month: 10, year: 2000 }, NOW)).toBeNull()
  })

  it('faltando algo, dia inexistente ou data futura não pode', () => {
    expect(birthdayError({ day: 10, month: 3, year: null }, NOW)).toMatch(/dia, o mês e o ano/)
    expect(birthdayError({ day: null, month: null, year: 2000 }, NOW)).toMatch(/dia, o mês e o ano/)
    expect(birthdayError({ day: 31, month: 4, year: 2000 }, NOW)).toMatch(/não existe/)
    expect(birthdayError({ day: 29, month: 2, year: 2001 }, NOW)).toMatch(/não existe/)
    expect(birthdayError({ day: 26, month: 10, year: 2026 }, NOW)).toMatch(/não vale/)
  })
})

describe('birthdayModalKey', () => {
  it('é por pessoa e por dia', () => {
    expect(birthdayModalKey('ana', '2026-10-25')).toBe('concord:birthday-modal:ana:2026-10-25')
  })
})
