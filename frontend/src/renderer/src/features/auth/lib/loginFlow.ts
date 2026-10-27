// Fluxo da tela de login sem React: validação dos campos e o "entrar" com as
// dependências injetadas (a página só aplica o resultado).
import type { AuthResponse, LoginInput } from '../api/auth'
import type { User } from '../store/authStore'
import { loginIdentifierError } from './loginIdentifier'
import { loginErrorMessage, statusOf } from './loginError'

export interface LoginFieldErrors {
  identifier: string | null
  password: string | null
}

export function loginFieldErrors(identifier: string, password: string): LoginFieldErrors {
  return {
    identifier: loginIdentifierError(identifier),
    password: password ? null : 'Informe sua senha.'
  }
}

export function hasFieldErrors(errors: LoginFieldErrors): boolean {
  return errors.identifier !== null || errors.password !== null
}

export interface LoginFailure {
  message: string
}

export type LoginOutcome = { kind: 'ok' } | { kind: 'invalid' } | ({ kind: 'error' } & LoginFailure)

export interface LoginDeps {
  login(input: LoginInput): Promise<AuthResponse>
  getMe(): Promise<User>
  setTokens(accessToken: string, refreshToken: string): void
  setUser(user: User): void
  openInvite(code: string): void
}

export async function runLogin(
  deps: LoginDeps,
  input: LoginInput,
  inviteCode: string | null
): Promise<LoginOutcome> {
  try {
    const tokens = await deps.login(input)
    if (inviteCode) deps.openInvite(inviteCode)
    deps.setTokens(tokens.access_token, tokens.refresh_token)
    deps.setUser(await deps.getMe())
    return { kind: 'ok' }
  } catch (err) {
    // Como no Discord: 401 não diz qual dos dois está errado.
    if (statusOf(err) === 401) return { kind: 'invalid' }
    return { kind: 'error', message: loginErrorMessage(err) }
  }
}

/** Aviso deixado pela tela anterior (ex.: "senha alterada") no state da rota. */
export function noticeFromState(state: unknown): string | null {
  return (state as { notice?: string } | null)?.notice ?? null
}
