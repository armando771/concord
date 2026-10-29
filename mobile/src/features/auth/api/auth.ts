import { rawRequest, request } from '../../../shared/api/client'
import type { User } from '../store/authStore'

export interface AuthResponse {
  access_token: string
  refresh_token: string
}

export interface LoginInput {
  /** E-mail ou nome de usuário (com ou sem "@" na frente). */
  login: string
  /** Campo antigo; mesmo valor de login, para backends ainda não atualizados. */
  email: string
  password: string
}

export interface RegisterInput {
  username: string
  display_name: string
  email: string
  password: string
}

const post = (body: unknown): RequestInit => ({ method: 'POST', body: JSON.stringify(body) })

export const login = (input: LoginInput): Promise<AuthResponse> => rawRequest('/auth/login', post(input))

export const register = (input: RegisterInput): Promise<AuthResponse> =>
  rawRequest('/auth/register', post(input))

export const forgotPassword = (email: string): Promise<void> =>
  rawRequest('/auth/forgot-password', post({ email }))

export const logout = (): Promise<void> => request('/auth/logout', { method: 'POST' })

let meInflight: Promise<User> | null = null

/** /users/me; chamadas simultâneas (login + boot) compartilham a mesma requisição. */
export function getMe(): Promise<User> {
  meInflight ??= request<User>('/users/me').finally(() => {
    meInflight = null
  })
  return meInflight
}
