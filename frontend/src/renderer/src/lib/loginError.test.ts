import { describe, expect, it } from 'vitest'
import { loginErrorMessage } from './loginError'

// Mesmo formato do ApiError (status + message), sem importar o client.
function apiError(status: number, message: string): Error & { status: number } {
  return Object.assign(new Error(message), { status })
}

describe('loginErrorMessage', () => {
  it('401 vira credenciais incorretas, seja qual for o texto do backend', () => {
    expect(loginErrorMessage(apiError(401, 'invalid credentials'))).toBe(
      'E-mail/usuário ou senha incorretos.'
    )
    expect(loginErrorMessage(apiError(401, 'outra coisa'))).toBe(
      'E-mail/usuário ou senha incorretos.'
    )
  })

  it('400, 429 e 5xx têm texto próprio em português', () => {
    expect(loginErrorMessage(apiError(400, 'invalid request'))).toBe(
      'Não foi possível entrar. Confira os dados e tente de novo.'
    )
    expect(loginErrorMessage(apiError(429, 'too many requests'))).toBe(
      'Muitas tentativas. Espere um pouco e tente de novo.'
    )
    expect(loginErrorMessage(apiError(500, 'failed to generate token'))).toBe(
      'Erro no servidor. Tente de novo em instantes.'
    )
    expect(loginErrorMessage(apiError(503, 'Request failed'))).toBe(
      'Erro no servidor. Tente de novo em instantes.'
    )
  })

  it('sem resposta (timeout ou rede fora) vira sem conexão', () => {
    expect(loginErrorMessage(apiError(0, 'Request timed out'))).toBe('Sem conexão com o servidor.')
    expect(loginErrorMessage(new TypeError('Failed to fetch'))).toBe('Sem conexão com o servidor.')
  })

  it('qualquer outra coisa cai no genérico', () => {
    expect(loginErrorMessage(apiError(404, 'not found'))).toBe('Falha ao entrar.')
    expect(loginErrorMessage(new Error('boom'))).toBe('Falha ao entrar.')
    expect(loginErrorMessage('x')).toBe('Falha ao entrar.')
  })
})
