import { create } from 'zustand'
import type { WsEvent } from '../api/ws'
import { boostRank } from '../lib/boost'

export interface CallBoost {
  percent: number
  eligible: number
}

export interface BoostCelebration {
  percent: number
  eligible: number
  /** Muda a cada ativação/subida, para reiniciar a animação. */
  key: number
}

interface BoostState {
  /** Buff de XP de cada call (só as que têm). */
  byCall: Record<string, CallBoost>
  /** Banner de ativação tocando agora (só aparece para quem está na call). */
  celebration: BoostCelebration | null
  handleWsEvent: (event: WsEvent) => void
  /** Só em dev: liga um buff falso na call `callId`. */
  previewBoost: (callId: string, percent: number) => void
  reset: () => void
}

/**
 * O backend manda `voice:boost` a cada tick (10 s) enquanto a call tem buff e
 * um último com percent 100 quando acaba. Sem heartbeat por tanto tempo (queda
 * de conexão, evento perdido) o buff é descartado.
 */
export const BOOST_EXPIRE_MS = 25_000

let celebrationSeq = 0
let celebrationTimer: ReturnType<typeof setTimeout> | null = null
const expireTimers = new Map<string, ReturnType<typeof setTimeout>>()

function stageOf(percent: number): number {
  return boostRank(percent)?.stage ?? 0
}

export const useBoostStore = create<BoostState>()((set, get) => {
  const celebrate = (percent: number, eligible: number): void => {
    const rank = boostRank(percent)
    if (!rank) return
    const key = ++celebrationSeq
    if (celebrationTimer) clearTimeout(celebrationTimer)
    set({ celebration: { percent, eligible, key } })
    celebrationTimer = setTimeout(() => {
      if (get().celebration?.key === key) set({ celebration: null })
    }, rank.durationMs)
  }

  const clearCall = (callId: string): void => {
    const timer = expireTimers.get(callId)
    if (timer) clearTimeout(timer)
    expireTimers.delete(callId)
    set((state) => {
      if (!(callId in state.byCall)) return {}
      const byCall = { ...state.byCall }
      delete byCall[callId]
      return { byCall }
    })
  }

  const apply = (callId: string, percent: number, eligible: number): void => {
    const previous = get().byCall[callId]?.percent ?? 100
    if (percent <= 100) {
      clearCall(callId)
      return
    }

    set((state) => ({ byCall: { ...state.byCall, [callId]: { percent, eligible } } }))
    const timer = expireTimers.get(callId)
    if (timer) clearTimeout(timer)
    expireTimers.set(
      callId,
      setTimeout(() => clearCall(callId), BOOST_EXPIRE_MS)
    )

    // Banner só ao ativar ou subir de rank (heartbeat e descer não repetem).
    if (stageOf(percent) > stageOf(previous)) celebrate(percent, eligible)
  }

  return {
    byCall: {},
    celebration: null,

    handleWsEvent: (event) => {
      if (event.type !== 'voice:boost') return
      const p = event.payload as { call_id?: string; percent?: number; eligible?: number }
      if (!p.call_id || typeof p.percent !== 'number') return
      apply(p.call_id, p.percent, p.eligible ?? 0)
    },

    previewBoost: (callId, percent) => {
      if (!Number.isFinite(percent)) return
      apply(callId, Math.floor(percent), 0)
    },

    reset: () => {
      expireTimers.forEach((timer) => clearTimeout(timer))
      expireTimers.clear()
      if (celebrationTimer) clearTimeout(celebrationTimer)
      celebrationTimer = null
      set({ byCall: {}, celebration: null })
    }
  }
})
