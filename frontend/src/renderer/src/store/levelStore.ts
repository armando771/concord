import { create } from 'zustand'
import type { WsEvent } from '../api/ws'
import { fetchLevels, fetchMyLevel, type LevelProgress } from '../api/levels'
import { useAuthStore } from './authStore'

/** Quanto tempo a animação de "subiu de nível" fica na tela. */
export const CELEBRATION_MS = 3200

export interface Celebration {
  level: number
  previous: number
  /** Muda a cada subida, para reiniciar a animação. */
  key: number
}

interface LevelState {
  /** Nível de cada usuário já carregado. */
  levels: Record<string, number>
  /** Progresso detalhado de quem está logado (barra de XP). */
  me: LevelProgress | null
  /** Quem está com a animação de subir de nível tocando agora. */
  celebrations: Record<string, Celebration>
  ensureLevels: (userIds: string[]) => void
  loadMe: () => Promise<void>
  handleWsEvent: (event: WsEvent) => void
  reset: () => void
}

// Pedidos de nível juntados em um só request (vários badges montam juntos).
const requested = new Set<string>()
let queued = new Set<string>()
let flushTimer: ReturnType<typeof setTimeout> | null = null
let celebrationSeq = 0

export const useLevelStore = create<LevelState>()((set, get) => ({
  levels: {},
  me: null,
  celebrations: {},

  ensureLevels: (userIds) => {
    for (const id of userIds) {
      if (id && !requested.has(id)) {
        requested.add(id)
        queued.add(id)
      }
    }
    if (queued.size === 0 || flushTimer) return
    flushTimer = setTimeout(async () => {
      flushTimer = null
      const ids = Array.from(queued)
      queued = new Set()
      const token = useAuthStore.getState().accessToken
      try {
        const map = await fetchLevels(ids)
        if (useAuthStore.getState().accessToken !== token) return
        set((state) => {
          const levels = { ...state.levels }
          for (const [id, progress] of Object.entries(map)) levels[id] = progress.level
          return { levels }
        })
      } catch (err) {
        ids.forEach((id) => requested.delete(id))
        console.error('[levelStore] fetchLevels failed:', err)
      }
    }, 50)
  },

  loadMe: async () => {
    try {
      const me = await fetchMyLevel()
      set((state) => ({ me, levels: { ...state.levels, [me.user_id]: me.level } }))
    } catch (err) {
      console.error('[levelStore] fetchMyLevel failed:', err)
    }
  },

  handleWsEvent: (event) => {
    if (event.type === 'level:update') {
      const me = event.payload as LevelProgress
      set((state) => ({ me, levels: { ...state.levels, [me.user_id]: me.level } }))
      return
    }

    if (event.type === 'level:up') {
      const payload = event.payload as { user_id: string; level: number; previous_level: number }
      // O mesmo evento chega pela sala da chamada, do servidor e do usuário.
      if (get().celebrations[payload.user_id]?.level === payload.level) return
      const key = ++celebrationSeq
      set((state) => ({
        levels: { ...state.levels, [payload.user_id]: payload.level },
        celebrations: {
          ...state.celebrations,
          [payload.user_id]: { level: payload.level, previous: payload.previous_level, key }
        }
      }))
      setTimeout(() => {
        set((state) => {
          if (state.celebrations[payload.user_id]?.key !== key) return {}
          const celebrations = { ...state.celebrations }
          delete celebrations[payload.user_id]
          return { celebrations }
        })
      }, CELEBRATION_MS)
    }
  },

  reset: () => {
    requested.clear()
    queued = new Set()
    set({ levels: {}, me: null, celebrations: {} })
  }
}))
