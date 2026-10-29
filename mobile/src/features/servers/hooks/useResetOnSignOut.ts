import { useEffect } from 'react'
import { useAuthStore } from '../../auth/store/authStore'
import { useSelectedServerStore } from '../store/selectedServerStore'
import { useServersStore } from '../store/serversStore'

/** Ao sair da conta, apaga servidores, canais e a seleção: nada vaza para a próxima conta. */
export function useResetOnSignOut(): void {
  const signedOut = useAuthStore((s) => s.status === 'signedOut')
  useEffect(() => {
    if (!signedOut) return
    useServersStore.getState().reset()
    useSelectedServerStore.getState().select(null)
  }, [signedOut])
}
