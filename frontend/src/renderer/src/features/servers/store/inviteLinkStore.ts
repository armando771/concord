import { create } from 'zustand'

/**
 * Convite aberto por link (navegador ou salinha://) esperando a confirmação
 * "Aceitar como …". O InviteConfirmModal, dentro do app logado, mostra.
 */
interface InviteLinkState {
  code: string | null
  open: (code: string) => void
  close: () => void
}

export const useInviteLinkStore = create<InviteLinkState>()((set) => ({
  code: null,
  open: (code) => set({ code }),
  close: () => set({ code: null })
}))
