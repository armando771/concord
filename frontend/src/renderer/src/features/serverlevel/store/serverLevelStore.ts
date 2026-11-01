import { create } from 'zustand'
import { fetchServerLevel } from '../api/serverLevel'
import type { ServerLevelProgress, SourceXP } from '../lib/serverLevel'

interface ServerLevelState {
  /** Nível de cada servidor já carregado (ou vindo do WS). */
  byServer: Record<string, ServerLevelProgress>
  /** XP dos últimos 7 dias por fonte, de cada servidor carregado. */
  week: Record<string, SourceXP[]>
  /** Busca o nível e a semana do servidor; falha deixa o que já tinha. */
  load: (serverId: string) => Promise<void>
  /** Progresso novo (server:level:update). */
  apply: (progress: ServerLevelProgress) => void
  reset: () => void
}

export const useServerLevelStore = create<ServerLevelState>((set) => ({
  byServer: {},
  week: {},
  load: async (serverId) => {
    try {
      const { week, ...progress } = await fetchServerLevel(serverId)
      set((s) => ({
        byServer: { ...s.byServer, [serverId]: progress },
        week: { ...s.week, [serverId]: week ?? [] }
      }))
    } catch {
      // Sem nível na tela é melhor que um erro: tenta de novo ao reabrir.
    }
  },
  apply: (progress) =>
    set((s) => ({ byServer: { ...s.byServer, [progress.server_id]: progress } })),
  reset: () => set({ byServer: {}, week: {} })
}))
