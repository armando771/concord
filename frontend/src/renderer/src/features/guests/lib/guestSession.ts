import type { User } from '../../auth/store/authStore'
import type { GuestSession } from '../api/guestInvites'

/**
 * O visitante sem conta no formato de usuário do app (authStore): só id, @ e
 * nome; o resto fica vazio (ele não tem perfil nem e-mail). Puro.
 */
export function guestAsUser(session: GuestSession): User {
  return {
    id: session.user.id,
    username: session.user.username,
    display_name: session.user.display_name,
    email: '',
    created_at: '',
    updated_at: ''
  }
}

/** Tem conta logada de verdade (não a sessão de um visitante sem conta)? */
export function hasAccount(accessToken: string | null, anonymousGuest: boolean): boolean {
  return Boolean(accessToken) && !anonymousGuest
}
