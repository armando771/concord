// Fluxos das telas de conta sem React: validação dos campos e as ações com as
// dependências injetadas (a tela só aplica o resultado). Porte enxuto do
// loginFlow do desktop, com cadastro e "esqueci a senha".
import type { Tokens } from '../../../shared/lib/authRefresh'
import type { AuthResponse, LoginInput, RegisterInput } from '../api/auth'
import type { User } from '../store/authStore'
import { emailActionErrorMessage, isConnectionError, loginErrorMessage, registerErrorMessage, statusOf } from './loginError'
import { loginIdentifierError } from './loginIdentifier'

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

export interface AuthDeps {
  login(input: LoginInput): Promise<AuthResponse>
  register(input: RegisterInput): Promise<AuthResponse>
  forgotPassword(email: string): Promise<void>
  getMe(): Promise<User>
  signIn(tokens: Tokens): Promise<void>
  setUser(user: User): void
}

export interface AuthFailure {
  message: string
  /** Nem chegou ao servidor (rede, DNS, bloqueio). */
  offline: boolean
}

export type AuthOutcome = { kind: 'ok' } | ({ kind: 'error' } & AuthFailure)
export type LoginOutcome = AuthOutcome | { kind: 'invalid' }

const toTokens = (r: AuthResponse): Tokens => ({ accessToken: r.access_token, refreshToken: r.refresh_token })

async function enter(deps: AuthDeps, response: AuthResponse): Promise<void> {
  await deps.signIn(toTokens(response))
  deps.setUser(await deps.getMe())
}

const failure = (err: unknown, message: (e: unknown) => string): AuthOutcome => ({
  kind: 'error',
  message: message(err),
  offline: isConnectionError(err)
})

export async function runLogin(deps: AuthDeps, input: LoginInput): Promise<LoginOutcome> {
  try {
    await enter(deps, await deps.login(input))
    return { kind: 'ok' }
  } catch (err) {
    // Como no Discord: 401 não diz qual dos dois está errado.
    if (statusOf(err) === 401) return { kind: 'invalid' }
    return failure(err, loginErrorMessage)
  }
}

export async function runRegister(deps: AuthDeps, input: RegisterInput): Promise<AuthOutcome> {
  try {
    await enter(deps, await deps.register(input))
    return { kind: 'ok' }
  } catch (err) {
    return failure(err, registerErrorMessage)
  }
}

export async function runForgotPassword(deps: AuthDeps, email: string): Promise<AuthOutcome> {
  try {
    await deps.forgotPassword(email.trim())
    return { kind: 'ok' }
  } catch (err) {
    return failure(err, emailActionErrorMessage)
  }
}
