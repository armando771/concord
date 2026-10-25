import { useEffect, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuthStore } from '../store/authStore'
import { getMe } from '../api/users'
import { ApiError } from '../api/client'
import { isDefinitiveRejection } from '../lib/authRefresh'

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
      <div className="flex h-full flex-col items-center justify-center gap-4">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/20 border-t-violet-500" />
        {offline && (
          <p className="text-sm text-gray-400">Sem conexão com o servidor. Tentando de novo…</p>
        )}
      </div>
    )
  }

  return children
}

export default RequireAuth
