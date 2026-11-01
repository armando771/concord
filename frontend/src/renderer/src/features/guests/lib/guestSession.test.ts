import { describe, expect, it } from 'vitest'
import { guestAsUser, hasAccount } from './guestSession'

describe('sessão do visitante sem conta', () => {
  it('vira um usuário mínimo do app', () => {
    const user = guestAsUser({
      token: 't',
      user: { id: 'g1', username: 'visitante-abc', display_name: 'Ana' },
      pass: {} as never
    })
    expect(user).toMatchObject({
      id: 'g1',
      username: 'visitante-abc',
      display_name: 'Ana',
      email: ''
    })
  })

  it('só conta como conta logada o token que não é de visitante', () => {
    expect(hasAccount('tok', false)).toBe(true)
    expect(hasAccount('tok', true)).toBe(false)
    expect(hasAccount(null, false)).toBe(false)
  })
})
