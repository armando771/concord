import { rawRequest, request } from './client'

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

export function logout(): Promise<void> {
  return request<void>('/auth/logout', { method: 'POST' })
}
