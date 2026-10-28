import { useCallback, useEffect, useState } from 'react'
import { useCallStore } from '../../call/store/callStore'
import { getGuestPasses, type GuestPass } from '../api/guestInvites'
import { guestCallPhase, passOfServer, type GuestCallPhase } from '../lib/guestCallPhase'
import { useGuestSessionStore } from '../store/guestSessionStore'
import { showToast } from '../../../shared/store/toastStore'
import { GUEST_COPY } from '../lib/guestCopy'

/** Entra na call do canal; sala trancada vira aviso (a tela oferece voltar). */
function enter(channelId: string): Promise<void> {
  return useCallStore
    .getState()
    .startChannelCall(channelId)
    .catch(() => {
      showToast.error(GUEST_COPY.locked)
    })
}

/** Encerra o acesso no fim do prazo (o servidor também tira; isto só adianta a tela). */
function useExpiry(expiresAt: string): void {
  useEffect(() => {
    const ms = new Date(expiresAt).getTime() - Date.now()
    const id = setTimeout(() => useGuestSessionStore.getState().end('expired'), Math.max(0, ms))
    return () => clearTimeout(id)
  }, [expiresAt])
}

/** Movido por um moderador: relê o acesso (nome do canal novo). */
function useMovedPass(pass: GuestPass): void {
  const channelId = useCallStore((s) => s.channelId)
  useEffect(() => {
    if (!channelId || channelId === pass.channel_id) return
    getGuestPasses()
      .then((passes) => {
        const current = passOfServer(passes, pass.server_id)
        if (current) useGuestSessionStore.getState().setPass(current)
      })
      .catch(() => {})
  }, [channelId, pass.channel_id, pass.server_id])
}

/**
 * A call do visitante: entra no canal do acesso ao abrir a tela, avisa quando
 * ele sai (para voltar) e acompanha mover e fim do prazo.
 */
export function useGuestCall(pass: GuestPass): { phase: GuestCallPhase; rejoin: () => void } {
  const status = useCallStore((s) => s.status)
  const [tried, setTried] = useState(false)

  const rejoin = useCallback(() => {
    const target = useGuestSessionStore.getState().pass?.channel_id ?? pass.channel_id
    setTried(false)
    void enter(target).finally(() => setTried(true))
  }, [pass.channel_id])

  // Ao abrir a tela entra na call; voltar depois é pelo botão.
  useEffect(() => {
    if (useCallStore.getState().status !== 'idle') return
    void enter(pass.channel_id).finally(() => setTried(true))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useExpiry(pass.expires_at)
  useMovedPass(pass)
  return { phase: guestCallPhase(status, tried), rejoin }
}
