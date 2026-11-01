import { useEffect } from 'react'
import { useAuthStore } from '../../auth/store/authStore'
import { silenceForeground } from '../lib/expoPush'
import { pushRegistration } from '../lib/pushSession'

/** Registra o aparelho para push depois do login. Sem Firebase configurado no build, não faz nada. */
export function usePushRegistration(): void {
  const signedIn = useAuthStore((s) => s.status === 'signedIn')

  useEffect(() => {
    silenceForeground()
  }, [])

  useEffect(() => {
    if (!signedIn) return
    void pushRegistration.start()
    return () => pushRegistration.stop()
  }, [signedIn])
}
