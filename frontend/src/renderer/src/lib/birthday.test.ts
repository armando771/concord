import { describe, expect, it } from 'vitest'
import { birthdayError, birthdayModalKey, daysInMonth } from './birthday'

describe('daysInMonth', () => {
  it('fevereiro aceita 29; abril tem 30', () => {
    expect(daysInMonth(2)).toBe(29)
    expect(daysInMonth(4)).toBe(30)
    expect(daysInMonth(12)).toBe(31)
    expect(daysInMonth(null)).toBe(31)
  })
})

describe('birthdayError', () => {
  it('os dois vazios ou uma data válida pode salvar', () => {
    expect(birthdayError({ day: null, month: null })).toBeNull()
    expect(birthdayError({ day: 29, month: 2 })).toBeNull()
  })

  it('só um preenchido ou dia inexistente não pode', () => {
    expect(birthdayError({ day: 10, month: null })).toMatch(/dia e o mês/)
    expect(birthdayError({ day: null, month: 3 })).toMatch(/dia e o mês/)
    expect(birthdayError({ day: 31, month: 4 })).toMatch(/não existe/)
  })
})

describe('birthdayModalKey', () => {
  it('é por pessoa e por dia', () => {
    expect(birthdayModalKey('ana', '2026-10-25')).toBe('concord:birthday-modal:ana:2026-10-25')
  })
})
