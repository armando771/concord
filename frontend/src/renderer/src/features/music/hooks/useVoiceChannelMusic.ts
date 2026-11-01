import { useEffect } from 'react'
import { useCallStore } from '../../call/store/callStore'
import { useMusicStore } from '../store/musicStore'
import { useMusicWatching } from './useMusicWatching'

/**
 * Conectado no canal de voz do servidor: acompanha o Maestro e carrega o que
 * ele está tocando (a cada chamada nova); ao sair, limpa.
 */
export function useVoiceChannelMusic(connectedHere: boolean, serverId: string | undefined): void {
  const callId = useCallStore((s) => s.callId)
  const loadState = useMusicStore((s) => s.loadState)
  const clearState = useMusicStore((s) => s.clearState)
  useMusicWatching(connectedHere ? serverId : null)

  useEffect(() => {
    if (!connectedHere || !serverId) return
    void loadState(serverId).catch(() => {})
    return () => clearState()
  }, [connectedHere, serverId, callId, loadState, clearState])
}
