import { PASSWORD_TOO_LONG, passwordTooLong } from './password'

describe('passwordTooLong', () => {
  it('conta bytes (UTF-8), com limite 72 como o bcrypt', () => {
    expect(passwordTooLong('a'.repeat(72))).toBe(false)
    expect(passwordTooLong('a'.repeat(73))).toBe(true)
    // "é" tem 2 bytes: 36 cabem, 37 não.
    expect(passwordTooLong('é'.repeat(36))).toBe(false)
    expect(passwordTooLong('é'.repeat(37))).toBe(true)
  })

  it('mensagem da tela (a do backend é a mesma, sem o ponto)', () => {
    expect(PASSWORD_TOO_LONG).toBe('Senha muito longa (máx. 72 bytes).')
  })
})
