import NetInfo from '@react-native-community/netinfo'
import { useEffect } from 'react'
import { AppState } from 'react-native'
import { realtime } from '../../../shared/api/realtime'
import { bindRealtimeLifecycle } from '../../../shared/api/realtimeLifecycle'
import { useNetworkStore } from '../../../shared/store/networkStore'
import { useAuthStore } from '../store/authStore'

/**
 * Com a sessão ativa, mantém o WebSocket conectado (e reconecta ao voltar do
 * segundo plano ou da queda de rede); no logout, desconecta.
 */
export function useRealtimeSession(): void {
  const signedIn = useAuthStore((s) => s.status === 'signedIn')

  useEffect(() => {
    if (!signedIn) return
    realtime.connect()
    const stop = bindRealtimeLifecycle(realtime, AppState, NetInfo)
    return () => {
      stop()
      realtime.disconnect()
    }
  }, [signedIn])

  // O usuário só carrega (GET /users/me) depois do WebSocket abrir, e o cliente só assina a sala pessoal
  // sozinho se já souber o id na abertura: sem isto, pedidos de amizade e DMs não chegavam ao vivo.
  const userId = useAuthStore((s) => s.user?.id)
  useEffect(() => {
    if (signedIn && userId) realtime.subscribe(`user:${userId}`)
  }, [signedIn, userId])
}

/** Espelha o estado da rede no networkStore (faixa "Sem conexão"). */
export function useNetworkWatcher(): void {
  useEffect(
    () => NetInfo.addEventListener((state) => useNetworkStore.getState().setOnline(state.isConnected !== false)),
    []
  )
}
