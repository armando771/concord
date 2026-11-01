import { create } from 'zustand'

interface ServerLevelModalState {
  /** Servidor com o detalhamento do nível aberto (null = fechado). */
  serverId: string | null
  open: (serverId: string) => void
  close: () => void
}

/** O modal "Nível do servidor", aberto pelo menu do nome do servidor. */
export const useServerLevelModalStore = create<ServerLevelModalState>((set) => ({
  serverId: null,
  open: (serverId) => set({ serverId }),
  close: () => set({ serverId: null })
}))
