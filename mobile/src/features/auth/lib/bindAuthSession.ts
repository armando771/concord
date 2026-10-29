import { bindSession } from '../../../shared/api/session'
import { useAuthStore } from '../store/authStore'

/** Liga o cliente HTTP/WS (shared) à sessão do authStore. Chamado uma vez no boot. */
export function bindAuthSession(): void {
  bindSession({
    tokens: () => {
      const { accessToken, refreshToken } = useAuthStore.getState()
      return { accessToken, refreshToken }
    },
    userId: () => useAuthStore.getState().user?.id ?? null,
    setTokens: (tokens) => useAuthStore.getState().setTokens(tokens),
    expire: () => useAuthStore.getState().expire()
  })
}
