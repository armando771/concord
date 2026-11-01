import { create } from 'zustand'
import type { ActiveRoom } from '../lib/unreadCounts'

interface ActiveRoomState {
  /** Chat aberto na tela agora; mensagem dele não conta como não lida. */
  active: ActiveRoom | null
  setActive: (active: ActiveRoom | null) => void
}

export const useActiveRoomStore = create<ActiveRoomState>()((set) => ({
  active: null,
  setActive: (active) => set({ active })
}))
