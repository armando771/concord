import { create } from 'zustand'

type Counts = Record<string, number>

interface UnreadState {
  byChannel: Counts
  byServer: Counts
  /** Mensagem nova num canal fechado. Sem servidor conhecido, conta só no canal. */
  add: (channelId: string, serverId: string | null | undefined) => void
  /** Abriu o canal: zera e desconta do servidor. */
  clearChannel: (channelId: string, serverId: string | null | undefined) => void
  reset: () => void
}

const without = (counts: Counts, key: string): Counts => {
  const { [key]: _removed, ...rest } = counts
  return rest
}

// Só na sessão: o backend não guarda não lida de canal (só de DM), como no desktop.
export const useUnreadStore = create<UnreadState>()((set) => ({
  byChannel: {},
  byServer: {},
  add: (channelId, serverId) =>
    set((s) => ({
      byChannel: { ...s.byChannel, [channelId]: (s.byChannel[channelId] ?? 0) + 1 },
      byServer: serverId ? { ...s.byServer, [serverId]: (s.byServer[serverId] ?? 0) + 1 } : s.byServer
    })),
  clearChannel: (channelId, serverId) =>
    set((s) => {
      const count = s.byChannel[channelId] ?? 0
      if (count === 0) return s
      const left = serverId ? Math.max((s.byServer[serverId] ?? 0) - count, 0) : 0
      return {
        byChannel: without(s.byChannel, channelId),
        byServer: !serverId ? s.byServer : left > 0 ? { ...s.byServer, [serverId]: left } : without(s.byServer, serverId)
      }
    }),
  reset: () => set({ byChannel: {}, byServer: {} })
}))
