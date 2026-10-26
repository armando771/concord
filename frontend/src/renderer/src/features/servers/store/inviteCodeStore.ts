import { create } from 'zustand'

/**
 * Código de convite de cada servidor (o link de "Convidar"). Atualiza quando
 * alguém gera um link novo (server:invite_code), com o modal aberto ou não.
 */
interface InviteCodeState {
  codes: Record<string, string>
  set: (serverId: string, code: string) => void
}

export const useInviteCodeStore = create<InviteCodeState>()((set) => ({
  codes: {},
  set: (serverId, code) => set((s) => ({ codes: { ...s.codes, [serverId]: code } }))
}))
