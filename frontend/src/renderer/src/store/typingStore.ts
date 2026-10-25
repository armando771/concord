import { create } from 'zustand'
import type { WsEvent } from '../api/ws'
import {
  addTyper,
  nextTypingExpiry,
  pruneTypers,
  removeTyper,
  type TypingByRoom
} from '../lib/typing'
import { useAuthStore } from './authStore'

// Quem está digitando em cada sala (eventos typing/typing:stop do WS).
// Só memória: some sozinho 5 s depois do último aviso.

interface TypingPayload {
  room?: string
  user_id?: string
  display_name?: string
  username?: string
}

interface TypingState {
  byRoom: TypingByRoom
  handleWsEvent: (event: WsEvent) => void
  /** Mensagem da pessoa chegou na sala: ela parou de digitar. */
  messageArrived: (room: string, authorId: string) => void
  reset: () => void
}

let expiryTimer: ReturnType<typeof setTimeout> | null = null

function scheduleExpiry(): void {
  if (expiryTimer) clearTimeout(expiryTimer)
  expiryTimer = null
  const next = nextTypingExpiry(useTypingStore.getState().byRoom)
  if (next === null) return
  expiryTimer = setTimeout(
    () => {
      expiryTimer = null
      useTypingStore.setState((s) => ({ byRoom: pruneTypers(s.byRoom, Date.now()) }))
      scheduleExpiry()
    },
    Math.max(0, next - Date.now())
  )
}

export const useTypingStore = create<TypingState>()((set) => ({
  byRoom: {},

  handleWsEvent: (event) => {
    const p = event.payload as TypingPayload
    if (!p?.room || !p.user_id) return
    const { room, user_id: userId } = p
    if (event.type === 'typing') {
      if (userId === useAuthStore.getState().user?.id) return
      const name = p.display_name || p.username || 'Alguém'
      set((s) => ({ byRoom: addTyper(s.byRoom, room, userId, name, Date.now()) }))
    } else if (event.type === 'typing:stop') {
      set((s) => ({ byRoom: removeTyper(s.byRoom, room, userId) }))
    } else {
      return
    }
    scheduleExpiry()
  },

  messageArrived: (room, authorId) => {
    set((s) => ({ byRoom: removeTyper(s.byRoom, room, authorId) }))
    scheduleExpiry()
  },

  reset: () => {
    if (expiryTimer) clearTimeout(expiryTimer)
    expiryTimer = null
    set({ byRoom: {} })
  }
}))
