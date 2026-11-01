import { useEffect } from 'react'
import { getMe } from '../api/auth'
import { useAuthStore } from '../store/authStore'

/**
 * Sessão restaurada do Keystore vem sem o usuário: busca /users/me. Se o
 * servidor recusar, o cliente já encerra a sessão; falha de rede só tenta de
 * novo na próxima abertura (o app continua usável, a tela mostra "Sem conexão").
 */
export function useCurrentUser(): void {
  const signedIn = useAuthStore((s) => s.status === 'signedIn')
  const hasUser = useAuthStore((s) => s.user !== null)

  useEffect(() => {
    if (!signedIn || hasUser) return
    getMe()
      .then((user) => useAuthStore.getState().setUser(user))
      .catch(() => {})
  }, [signedIn, hasUser])
}
