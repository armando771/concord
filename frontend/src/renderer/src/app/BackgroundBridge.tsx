import { useEffect } from 'react'
import router from './router'
import { useCallStore } from '../features/call/store/callStore'
import { showToast } from '../shared/store/toastStore'
import { useAuthStore } from '../features/auth/store/authStore'
import { useInviteLinkStore } from '../features/servers/store/inviteLinkStore'
import { authPathWithInvite, normalizeInviteCode } from '../features/servers/lib/inviteLink'

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
        `Não deu para capturar só o som deste app — compartilhando sem som. Detalhes: ${logPath}`
      )
    })
    const offHidden = window.api?.screenShare?.onWindowHidden(() => {
      showToast.info(
        'A janela compartilhada foi minimizada e a live congelou para quem assiste. Restaure a janela ou compartilhe a tela inteira.'
      )
    })
    return () => {
      offHidden?.()
      offFallback?.()
      offMute()
      offQuit()
      offNavigate()
    }
  }, [background])

  // Link salinha://convite/<código> (o main guarda até aqui buscar): abre a
  // confirmação por cima de onde a pessoa está; deslogado, passa pelo login.
  useEffect(() => {
    const links = window.api?.inviteLinks
    if (!links) return
    const take = (): void => {
      void links.takePending().then((raw) => {
        const code = raw ? normalizeInviteCode(raw) : null
        if (!code) return
        if (useAuthStore.getState().accessToken) useInviteLinkStore.getState().open(code)
        else void router.navigate(authPathWithInvite('/login', code))
      })
    }
    take()
    return links.onPending(take)
  }, [])

  return null
}

export default BackgroundBridge
