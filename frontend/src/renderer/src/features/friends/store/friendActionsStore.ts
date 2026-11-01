import { create } from 'zustand'

// Confirmações de remover amigo e bloquear, abertas de qualquer lugar (linha
// de amigo, menu do botão direito, cartão de perfil).

interface Pending {
  kind: 'remove' | 'block'
  userId: string
  username: string
  name: string
}

interface FriendActionsState {
  pending: Pending | null
  ask: (p: Pending) => void
  close: () => void
}

export const useFriendActions = create<FriendActionsState>()((set) => ({
  pending: null,
  ask: (pending) => set({ pending }),
  close: () => set({ pending: null })
}))

export function confirmRemoveFriend(user: {
  userId: string
  username: string
  name: string
}): void {
  useFriendActions.getState().ask({ kind: 'remove', ...user })
}

export function confirmBlock(user: { userId: string; username: string; name: string }): void {
  useFriendActions.getState().ask({ kind: 'block', ...user })
}
