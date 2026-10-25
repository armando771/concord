import { create } from 'zustand'

// Nomes dos canais por servidor para o painel "Voz conectada". O serverStore
// só tem os canais do servidor aberto; a chamada continua quando você vai para
// outro servidor ou para as DMs, e o painel ainda precisa do nome.

/** Depois disso a lista é buscada de novo (canal renomeado em outro servidor). */
export const CHANNEL_NAMES_TTL_MS = 60_000

export function channelNamesStale(fetchedAt: number | undefined, now: number): boolean {
  return fetchedAt === undefined || now - fetchedAt >= CHANNEL_NAMES_TTL_MS
}

interface ChannelNameState {
  /** servidor → canal → nome. */
  byServer: Record<string, Record<string, string>>
  /** Quando a lista de cada servidor chegou (sem entrada = buscar). */
  fetchedAt: Record<string, number>
  nameOf: (serverId: string, channelId: string) => string | null
  /** Lista completa do servidor: substitui a antiga (apagados somem). */
  learn: (serverId: string, channels: { id: string; name: string }[], now?: number) => void
  /** Um canal do servidor mudou (channel:create/update/delete): buscar de novo. */
  invalidate: (serverId: string) => void
  reset: () => void
}

export const useChannelNameStore = create<ChannelNameState>()((set, get) => ({
  byServer: {},
  fetchedAt: {},
  nameOf: (serverId, channelId) => get().byServer[serverId]?.[channelId] ?? null,
  learn: (serverId, channels, now = Date.now()) =>
    set((s) => ({
      byServer: {
        ...s.byServer,
        [serverId]: Object.fromEntries(channels.map((c) => [c.id, c.name]))
      },
      fetchedAt: { ...s.fetchedAt, [serverId]: now }
    })),
  invalidate: (serverId) =>
    set((s) => {
      if (!(serverId in s.fetchedAt)) return s
      const fetchedAt = { ...s.fetchedAt }
      delete fetchedAt[serverId]
      return { fetchedAt }
    }),
  reset: () => set({ byServer: {}, fetchedAt: {} })
}))
