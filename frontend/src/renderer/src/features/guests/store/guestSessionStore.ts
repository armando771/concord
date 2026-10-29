import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { GuestPass } from '../api/guestInvites'

/**
 * A sessão do visitante SEM conta neste navegador: por qual link entrou (o
 * token de visitante está no authStore) e o acesso atual. Fica salva para
 * recarregar a página e voltar para a call enquanto o acesso vale. Quem tem
 * conta não usa isto: as visitas dele ficam no guestVisitsStore, dentro do app.
 */
interface GuestSessionState {
  /** Token do link de convite por onde entrou. */
  link: string | null
  /** Sessão de visitante sem conta em andamento. */
  anonymous: boolean
  pass: GuestPass | null
  /** Por que acabou (guest:ended ou 'left' ao sair), até a pessoa sair da tela final. */
  ended: string | null
  start: (link: string, pass: GuestPass) => void
  setPass: (pass: GuestPass) => void
  end: (reason: string) => void
  clear: () => void
}

const EMPTY = { link: null, anonymous: false, pass: null, ended: null }

/**
 * Versão 0 também guardava a entrada de quem tem conta (tela isolada da
 * call): essa sessão some, a visita agora mora no app.
 */
export function migrateGuestSession(persisted: unknown, version: number): unknown {
  const state = persisted as { anonymous?: boolean } | null
  if (version < 1 && !state?.anonymous) return EMPTY
  return persisted
}

export const useGuestSessionStore = create<GuestSessionState>()(
  persist(
    (set) => ({
      ...EMPTY,
      start: (link, pass) => set({ link, pass, anonymous: true, ended: null }),
      setPass: (pass) => set({ pass }),
      end: (reason) => set({ ended: reason }),
      clear: () => set(EMPTY)
    }),
    { name: 'salinha-guest-session', version: 1, migrate: migrateGuestSession as never }
  )
)

/** Link da sessão de visitante sem conta em andamento (ou null). */
export function anonymousGuestLink(
  state: Pick<GuestSessionState, 'link' | 'anonymous' | 'ended'>
): string | null {
  return state.anonymous && state.link && !state.ended ? state.link : null
}
