import { create } from 'zustand'
import { fetchPresence } from '../api/presence'
import { presenceStatusOf, type PresenceStatus } from '../lib/presenceStatus'

interface PresenceState {
  statuses: Record<string, PresenceStatus>
  /** Busca o status de várias pessoas (falha de rede mantém o que já se sabe). */
  load: (userIds: string[]) => Promise<void>
  /** Aplica um `presence:update` do WebSocket. */
  apply: (payload: { user_id?: string; status?: unknown; online?: unknown }) => void
  reset: () => void
}

export const usePresenceStore = create<PresenceState>()((set) => ({
  statuses: {},
  load: async (userIds) => {
    if (userIds.length === 0) return
    try {
      const map = await fetchPresence(userIds)
      const loaded = Object.fromEntries(Object.entries(map).map(([id, value]) => [id, presenceStatusOf(value, value)]))
      set((s) => ({ statuses: { ...s.statuses, ...loaded } }))
    } catch {
      // sem rede: fica com o que já tinha
    }
  },
  apply: ({ user_id, status, online }) => {
    if (!user_id) return
    set((s) => ({ statuses: { ...s.statuses, [user_id]: presenceStatusOf(status, online) } }))
  },
  reset: () => set({ statuses: {} })
}))
