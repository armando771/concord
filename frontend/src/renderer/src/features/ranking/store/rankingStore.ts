import { create } from 'zustand'
import { fetchRanking, type Ranking } from '../api/ranking'

interface RankingState {
  ranking: Ranking | null
  /** Só no primeiro carregamento: recarregar mostra o ranking antigo até o novo chegar. */
  loading: boolean
  error: string | null
  fetch: () => Promise<void>
}

export const useRankingStore = create<RankingState>()((set, get) => ({
  ranking: null,
  loading: false,
  error: null,
  fetch: async () => {
    if (get().ranking === null) set({ loading: true })
    try {
      set({ ranking: await fetchRanking(), error: null })
    } catch (err) {
      console.error('[rankingStore] fetch error:', err)
      set({ error: 'Não foi possível carregar o ranking.' })
    } finally {
      set({ loading: false })
    }
  }
}))
