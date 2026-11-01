import { rawRequest, request } from '../../../shared/api/client'

export interface AuthResponse {
  access_token: string
  refresh_token: string
}

export interface RegisterInput {
  username: string
  display_name: string
  email: string
  password: string
  /** Aniversário opcional (dia, mês e ano). */
  birthday_day?: number
  birthday_month?: number
  birthday_year?: number
}

export interface LoginInput {
  /** E-mail ou nome de usuário (com ou sem "@" na frente). */
  login: string
  /** Campo antigo; mesmo valor de login, para backends ainda não atualizados. */
  email: string
  password: string
}

export function register(input: RegisterInput): Promise<AuthResponse> {
  return rawRequest<AuthResponse>('/auth/register', {
    method: 'POST',
    body: JSON.stringify(input)
  })
}

export function login(input: LoginInput): Promise<AuthResponse> {
  return rawRequest<AuthResponse>('/auth/login', {
    method: 'POST',
    body: JSON.stringify(input)
  })
}

export function verifyEmail(token: string): Promise<void> {
  return rawRequest<void>('/auth/verify-email', {
    method: 'POST',
    body: JSON.stringify({ token })
  })
}

/** Reenvia o e-mail de confirmação; sent=false quando já estava confirmado. */
export function resendVerification(): Promise<{ sent: boolean }> {
  return request<{ sent: boolean }>('/auth/resend-verification', { method: 'POST' })
}

export function forgotPassword(email: string): Promise<void> {
  return rawRequest<void>('/auth/forgot-password', {
    method: 'POST',
    body: JSON.stringify({ email })
  })
}

export function resetPassword(token: string, password: string): Promise<void> {
  return rawRequest<void>('/auth/reset-password', {
    method: 'POST',
    body: JSON.stringify({ token, password })
  })
}

export function logout(): Promise<void> {
  return request<void>('/auth/logout', { method: 'POST' })
}
