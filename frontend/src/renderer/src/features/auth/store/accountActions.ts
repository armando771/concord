import { changeEmail, changeUsername } from '../api/account'
import { useAuthStore, type User } from './authStore'

// Ações da própria conta que gravam o usuário que o servidor devolveu.

/** Grava a conta nova. O status é o escolhido nesta sessão: o local manda. */
export function commitMe(latest: User): void {
  const { user: current, setUser } = useAuthStore.getState()
  setUser({ ...latest, status: current?.status ?? latest.status })
}

export async function changeMyUsername(username: string, password: string): Promise<void> {
  commitMe(await changeUsername(username, password))
}

export async function changeMyEmail(email: string, password: string): Promise<void> {
  commitMe(await changeEmail(email, password))
}
