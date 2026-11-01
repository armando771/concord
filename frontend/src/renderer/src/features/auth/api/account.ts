import { request } from '../../../shared/api/client'
import type { User } from '../store/authStore'

// Troca dos dados de login (Configurações → Minha conta): sempre com a senha atual.

export function changeUsername(username: string, password: string): Promise<User> {
  return request<User>('/users/me/username', {
    method: 'PUT',
    body: JSON.stringify({ username, password })
  })
}

/** E-mail novo volta a "não confirmado" e recebe o link de confirmação. */
export function changeEmail(email: string, password: string): Promise<User> {
  return request<User>('/users/me/email', {
    method: 'PUT',
    body: JSON.stringify({ email, password })
  })
}
