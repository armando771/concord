import { create } from 'zustand'

// Menu do botão direito sobre um usuário (participante de chamada ou membro).

export interface UserMenuTarget {
  userId: string
  name: string
  /** para o pedido de amizade */
  username?: string
  x: number
  y: number
}

interface UserMenuState {
  target: UserMenuTarget | null
  open: (target: UserMenuTarget) => void
  close: () => void
}

export const useUserMenuStore = create<UserMenuState>()((set) => ({
  target: null,
  open: (target) => set({ target }),
  close: () => set({ target: null })
}))

/** onContextMenu pronto para um usuário (não abre para você mesmo). */
export function userMenuHandler(
  userId: string,
  name: string,
  meId: string | undefined,
  username?: string
): ((e: React.MouseEvent) => void) | undefined {
  if (!userId || userId === meId) return undefined
  return (e) => {
    e.preventDefault()
    useUserMenuStore.getState().open({ userId, name, username, x: e.clientX, y: e.clientY })
  }
}
