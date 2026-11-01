import type { LoginInput } from '../api/auth'

/** Erro do campo "E-mail ou nome de usuário", ou null se dá para tentar. */
export function loginIdentifierError(value: string): string | null {
  return value.trim() ? null : 'Informe seu e-mail ou nome de usuário.'
}

/**
 * Corpo do POST /auth/login. Quem decide se é e-mail ou usuário (e tira o
 * "@" da frente) é o backend; "email" vai junto só para um backend antigo
 * continuar aceitando login por e-mail.
 */
export function buildLoginInput(identifier: string, password: string): LoginInput {
  const login = identifier.trim()
  return { login, email: login, password }
}
