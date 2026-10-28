import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { WsEvent } from '../../../shared/api/ws'
import type { GuestPass } from '../api/guestInvites'

/**
 * A sessão de visitante deste navegador: por qual link entrou, se é sem conta
 * (aí o token de visitante está no authStore) e o acesso atual. Fica salva
 * para recarregar a página e voltar para a call enquanto o acesso vale.
 */
interface GuestSessionState {
  /** Token do link de convite por onde entrou. */
  link: string | null
  /** Visitante sem conta (sessão de visitante no authStore). */
  anonymous: boolean
  pass: GuestPass | null
  /** Motivo do fim do acesso (guest:ended), até a pessoa sair da tela. */
  ended: string | null
  start: (link: string, pass: GuestPass, anonymous: boolean) => void
  setPass: (pass: GuestPass) => void
  end: (reason: string) => void
  clear: () => void
  handleWsEvent: (event: WsEvent) => void
}

const EMPTY = { link: null, anonymous: false, pass: null, ended: null }

export const useGuestSessionStore = create<GuestSessionState>()(
  persist(
    (set) => ({
      ...EMPTY,
      start: (link, pass, anonymous) => set({ link, pass, anonymous, ended: null }),
      setPass: (pass) => set({ pass }),
      end: (reason) => set({ ended: reason }),
      clear: () => set(EMPTY),
      handleWsEvent: (event) => {
        if (event.type !== 'guest:ended') return
        const reason = (event.payload as { reason?: string } | null)?.reason ?? 'removed'
        set({ ended: reason })
      }
    }),
    { name: 'salinha-guest-session' }
  )
)

/** Link da sessão de visitante sem conta em andamento (ou null). */
export function anonymousGuestLink(
  state: Pick<GuestSessionState, 'link' | 'anonymous' | 'ended'>
): string | null {
  return state.anonymous && state.link && !state.ended ? state.link : null
}
