import { useRouter } from 'expo-router'
import { useEffect } from 'react'
import { useAuthStore } from '../../auth/store/authStore'
import { useIncomingCallStore } from '../store/incomingCallStore'

/** Quando uma chamada de DM começa a tocar, abre a tela de atender (uma vez por chamada). */
export function useIncomingCallRoute(): void {
  const router = useRouter()
  const signedIn = useAuthStore((s) => s.status === 'signedIn')
  const callId = useIncomingCallStore((s) => s.call?.callId)

  useEffect(() => {
    if (signedIn && callId) router.push('/chamada-recebida')
  }, [signedIn, callId, router])
}
