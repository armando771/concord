import { describe, expect, it } from 'vitest'
import { ApiError } from '../../../shared/api/client'
import { guestErrorMessage } from './guestErrors'

describe('erros do convite de visitante', () => {
  it('traduz pelo código do servidor', () => {
    expect(guestErrorMessage(new ApiError(409, 'x', 'invite_full'), 'falhou')).toMatch(
      /número máximo/
    )
    expect(guestErrorMessage(new ApiError(400, 'x', 'invalid_name'), 'falhou')).toMatch(/2 a 32/)
  })

  it('limite de tentativas', () => {
    expect(guestErrorMessage(new ApiError(429, 'x'), 'falhou')).toMatch(/Muitas tentativas/)
  })

  it('o resto cai no texto padrão', () => {
    expect(guestErrorMessage(new ApiError(500, 'x', 'outro'), 'falhou')).toBe('falhou')
    expect(guestErrorMessage(new Error('rede'), 'falhou')).toBe('falhou')
  })
})
