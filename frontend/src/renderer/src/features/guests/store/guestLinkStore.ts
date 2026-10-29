import { create } from 'zustand'

/**
 * Link de visitante aberto por quem tem conta, esperando a confirmação
 * "Entrar na call … como visitante?" (GuestVisitConfirmModal, no AppShell).
 */
interface GuestLinkState {
  token: string | null
  open: (token: string) => void
  close: () => void
}

export const useGuestLinkStore = create<GuestLinkState>()((set) => ({
  token: null,
  open: (token) => set({ token }),
  close: () => set({ token: null })
}))
