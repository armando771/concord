import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { getMe } from '../../profile/api/users'
import { ApiError } from '../../../shared/api/client'
import { isDefinitiveRejection } from '../lib/authRefresh'
import { AppBootSkeleton } from '../../../shared/ui/skeleton/layouts'

interface RequireAuthProps {
  children: React.ReactElement
}

/** Sem conexão ao carregar o usuário: tenta de novo nesse intervalo. */
const RETRY_MS = 3000

function RequireAuth({ children }: RequireAuthProps): React.JSX.Element {
  const accessToken = useAuthStore((s) => s.accessToken)
  const user = useAuthStore((s) => s.user)
  const setUser = useAuthStore((s) => s.setUser)
  const [attempt, setAttempt] = useState(0)
  const [offline, setOffline] = useState(false)

  useEffect(() => {
    if (!accessToken || user) return

    let cancelled = false
    let retryTimer: ReturnType<typeof setTimeout> | undefined
    getMe()
      .then((me) => {
        if (!cancelled) {
          setOffline(false)
          setUser(me)
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return
        // Só o servidor recusando o login (401/403) encerra a sessão. Rede
        // fora ou servidor com erro: mantém os tokens e tenta de novo — senão
        // uma queda nesta aba deslogaria todas (o login é compartilhado).
        if (err instanceof ApiError && isDefinitiveRejection(err.status)) {
          useAuthStore.getState().clear()
          return
        }
        setOffline(true)
        retryTimer = setTimeout(() => setAttempt((n) => n + 1), RETRY_MS)
      })

    return () => {
      cancelled = true
      clearTimeout(retryTimer)
    }
  }, [accessToken, user, setUser, attempt])

  if (!accessToken) {
    return <Navigate to="/login" replace />
  }

  if (!user) {
    return (
      <AppBootSkeleton
        notice={offline ? 'Sem conexão com o servidor. Tentando de novo…' : undefined}
      />
    )
  }

  return children
}

export default RequireAuth
