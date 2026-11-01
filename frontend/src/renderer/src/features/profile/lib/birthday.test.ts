import { describe, expect, it, vi } from 'vitest'
import { birthdayError, birthdayModalKey, birthYears, daysInMonth, formatBirthday, trySaveBirthday } from './birthday'

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

describe('formatBirthday', () => {
  it('data completa por extenso; vazio vira "Não informado"', () => {
    expect(formatBirthday({ day: 7, month: 3, year: 1998 })).toBe('7 de março de 1998')
    expect(formatBirthday({ day: 25, month: 12, year: null })).toBe('25 de dezembro')
    expect(formatBirthday({ day: null, month: null, year: null })).toBe('Não informado')
  })
})

describe('trySaveBirthday', () => {
  const valid = { day: 7, month: 3, year: 1998, announce: true }
  it('data incompleta nem vai para o servidor', async () => {
    const send = vi.fn()
    const result = await trySaveBirthday({ ...valid, year: null }, send)
    expect(result).toEqual({ error: expect.stringMatching(/dia, o mês e o ano/) })
    expect(send).not.toHaveBeenCalled()
  })
  it('salva e devolve o que o servidor gravou', async () => {
    const send = vi.fn(async (b: typeof valid) => ({ ...b, announce: false }))
    expect(await trySaveBirthday(valid, send)).toEqual({ saved: { ...valid, announce: false } })
  })
  it('erro do servidor vira mensagem', async () => {
    const boom = vi.fn(async () => {
      throw new Error('fora do ar')
    })
    expect(await trySaveBirthday(valid, boom)).toEqual({ error: 'fora do ar' })
    const weird = vi.fn(async () => {
      throw 'x'
    })
    expect(await trySaveBirthday(valid, weird)).toEqual({
      error: 'Não foi possível salvar o aniversário.'
    })
  })
})
