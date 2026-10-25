import { create } from 'zustand'
import type { CardSide, Rect } from '../lib/profileCard'

// Cartão de perfil (clique numa pessoa, como no Discord).

export interface ProfileCardTarget {
  userId: string
  name: string
  username?: string
  anchor: Rect
  side: CardSide
  /** O que foi clicado: clicar nele de novo fecha (não conta como "fora"). */
  anchorEl?: HTMLElement
}

interface ProfileCardState {
  target: ProfileCardTarget | null
  open: (target: ProfileCardTarget) => void
  close: () => void
}

export const useProfileCardStore = create<ProfileCardState>()((set) => ({
  target: null,
  open: (target) => set({ target }),
  close: () => set({ target: null })
}))

/** onClick pronto: abre o cartão da pessoa ao lado do item clicado. */
export function profileCardHandler(
  userId: string,
  name: string,
  username: string | undefined,
  side: CardSide
): (e: React.MouseEvent<HTMLElement>) => void {
  return (e) => {
    const r = e.currentTarget.getBoundingClientRect()
    const current = useProfileCardStore.getState().target
    // Clicar de novo na mesma pessoa fecha o cartão.
    if (current?.userId === userId) {
      useProfileCardStore.getState().close()
      return
    }
    useProfileCardStore.getState().open({
      userId,
      name,
      username,
      side,
      anchor: { top: r.top, left: r.left, right: r.right, bottom: r.bottom },
      anchorEl: e.currentTarget
    })
  }
}
