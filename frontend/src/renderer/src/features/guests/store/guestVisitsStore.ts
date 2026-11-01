import { create } from 'zustand'
import type { GuestPass } from '../api/guestInvites'
import { removeVisit, upsertVisit } from '../lib/guestVisits'

/**
 * As visitas de quem tem conta: os acessos de visitante ativos (um por
 * servidor), cada um um item do trilho. Vem de /guest/passes e se atualiza
 * pelos eventos guest:pass e guest:ended.
 */
interface GuestVisitsState {
  visits: GuestPass[]
  /** Já leu a lista do servidor (antes disso, /visitas/<id> espera em vez de sair). */
  loaded: boolean
  set: (visits: GuestPass[]) => void
  upsert: (pass: GuestPass) => void
  remove: (serverId: string) => void
  reset: () => void
}

export const useGuestVisitsStore = create<GuestVisitsState>()((set) => ({
  visits: [],
  loaded: false,
  set: (visits) => set({ visits, loaded: true }),
  upsert: (pass) => set((s) => ({ visits: upsertVisit(s.visits, pass) })),
  remove: (serverId) => set((s) => ({ visits: removeVisit(s.visits, serverId) })),
  reset: () => set({ visits: [], loaded: false })
}))
