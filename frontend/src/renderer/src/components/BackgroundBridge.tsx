import { useEffect } from 'react'
import router from '../router'
import { useCallStore } from '../store/callStore'
import { showToast } from '../store/toastStore'

/**
 * Liga o app ao modo segundo plano do processo main: menu da bandeja
 * (silenciar/sair), cliques em notificações e o "Sair" que encerra a chamada.
 */
/** Tempo para o "saí da chamada" chegar ao servidor antes de fechar o app. */
const QUIT_FLUSH_MS = 250

function BackgroundBridge(): null {
  const status = useCallStore((s) => s.status)
  const muted = useCallStore((s) => s.muted)
  const background = window.api?.background

  useEffect(() => {
    background?.setCallState({ inCall: status === 'active', muted })
  }, [background, status, muted])

  useEffect(() => {
    if (!background) return
    const offMute = background.onToggleMute(() => {
      if (useCallStore.getState().status === 'active') useCallStore.getState().toggleMute()
    })
    const offQuit = background.onQuitRequested(() => {
      // Sai da chamada (avisa os outros) antes de fechar de verdade; a pausa
      // dá tempo do aviso sair pelo WebSocket.
      const inCall = useCallStore.getState().status !== 'idle'
      useCallStore.getState().endCall()
      setTimeout(() => background.quit(), inCall ? QUIT_FLUSH_MS : 0)
    })
    const offNavigate = background.onNavigate((route) => {
      void router.navigate(route)
    })
    const offFallback = window.api?.screenAudio?.onFallback((logPath) => {
      showToast.info(
        `Som só da janela indisponível — indo o som do PC (sem o Concord). Detalhes: ${logPath}`
      )
    })
    return () => {
      offFallback?.()
      offMute()
      offQuit()
      offNavigate()
    }
  }, [background])

  return null
}

export default BackgroundBridge
