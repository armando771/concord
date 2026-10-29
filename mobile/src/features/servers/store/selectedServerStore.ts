import { create } from 'zustand'

interface SelectedServerState {
  /** Servidor aberto no trilho; null = a área de DMs (ícone do topo). */
  serverId: string | null
  select: (serverId: string | null) => void
  /** Garante uma escolha válida: o primeiro servidor se não há (ou sumiu); DMs se não há servidores. */
  ensureSelection: (serverIds: string[]) => void
}

export const useSelectedServerStore = create<SelectedServerState>()((set, get) => ({
  serverId: null,
  select: (serverId) => set({ serverId }),
  ensureSelection: (serverIds) => {
    const current = get().serverId
    if (current && serverIds.includes(current)) return
    set({ serverId: serverIds[0] ?? null })
  }
}))
