import { create } from 'zustand'

// Menu do botão direito sobre um usuário (participante de chamada ou membro).

export interface UserMenuTarget {
  userId: string
  name: string
  /** para o pedido de amizade */
  username?: string
  /** menu da live (tela compartilhada) dessa pessoa, em vez do menu dela */
  stream?: boolean
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

/** onContextMenu da live (tela compartilhada) de alguém: volume e silenciar. */
export function streamMenuHandler(
  userId: string,
  name: string,
  meId: string | undefined
): ((e: React.MouseEvent) => void) | undefined {
  if (!userId || userId === meId) return undefined
  return (e) => {
    e.preventDefault()
    useUserMenuStore.getState().open({ userId, name, stream: true, x: e.clientX, y: e.clientY })
  }
}
