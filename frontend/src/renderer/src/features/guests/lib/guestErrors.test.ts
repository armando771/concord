import { describe, expect, it } from 'vitest'
import { ApiError } from '../../../shared/api/client'
import { alreadyMemberPath, guestErrorMessage } from './guestErrors'

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

describe('membro abrindo link de visitante', () => {
  it('vai para o canal de voz', () => {
    const err = new ApiError(409, 'x', 'already_member', { server_id: 's1', channel_id: 'c1' })
    expect(alreadyMemberPath(err)).toBe('/servers/s1/channels/c1')
  })
  it('outros erros não redirecionam', () => {
    expect(alreadyMemberPath(new ApiError(404, 'x', 'guest_invite_not_found'))).toBeNull()
    expect(alreadyMemberPath(new Error('x'))).toBeNull()
  })
})
