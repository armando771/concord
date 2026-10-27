import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import {
  listeningPayload,
  sanitizeListening,
  type DetectedTrack,
  type ListeningActivity
} from '../lib/listeningActivity'
import { useChatStore } from '../../chat/store/chatStore'

// "Ouvindo": a música de cada um (o que o servidor deixa eu ver) e a minha,
// detectada no desktop, a caminho do servidor. Separado do jogo
// (presenceActivityStore): os dois podem existir ao mesmo tempo.

interface ListeningState {
  byUser: Record<string, ListeningActivity>
  /** Música detectada neste PC (desktop), antes de ir ao servidor. */
  detected: DetectedTrack | null
  /** Mostrar minha música aos outros (Configurações → Privacidade). */
  enabled: boolean
  setListening: (userId: string, listening: ListeningActivity | null) => void
  /** Carga inicial (GET /presence/activities): a música vem em `listening`. */
  applyFetched: (requestedIds: string[], fetched: Record<string, unknown>) => void
  setDetected: (track: DetectedTrack | null) => void
  setEnabled: (enabled: boolean) => void
  /** Manda ao servidor o que vale agora (também ao reconectar o WS). */
  publishMine: () => void
  reset: () => void
}

function withUser(
  byUser: Record<string, ListeningActivity>,
  userId: string,
  listening: ListeningActivity | null
): Record<string, ListeningActivity> {
  const next = { ...byUser }
  if (listening) next[userId] = listening
  else delete next[userId]
  return next
}

function fetchedListening(entry: unknown): ListeningActivity | null {
  if (typeof entry !== 'object' || entry === null) return null
  return sanitizeListening((entry as { listening?: unknown }).listening)
}

/**
 * Já mandei uma música ao servidor? Só aí o "limpar" vai: sem nada para limpar,
 * não manda nada (servidor antigo leria o activity:clear como "parei de jogar").
 */
let sentListening = false

export const useListeningStore = create<ListeningState>()(
  persist(
    (set, get) => ({
      byUser: {},
      detected: null,
      enabled: true,
      setListening: (userId, listening) =>
        set((state) => ({ byUser: withUser(state.byUser, userId, listening) })),
      applyFetched: (requestedIds, fetched) =>
        set((state) => {
          let byUser = state.byUser
          for (const id of requestedIds)
            byUser = withUser(byUser, id, fetchedListening(fetched[id]))
          return { byUser }
        }),
      setDetected: (detected) => {
        set({ detected })
        get().publishMine()
      },
      setEnabled: (enabled) => {
        set({ enabled })
        get().publishMine()
      },
      publishMine: () => {
        const { detected, enabled } = get()
        const { sendEvent } = useChatStore.getState()
        if (enabled && detected) {
          sendEvent('activity:set', listeningPayload(detected, Date.now()))
          sentListening = true
        } else if (sentListening) {
          sendEvent('activity:clear', { kind: 'listening' })
          sentListening = false
        }
      },
      reset: () => set({ byUser: {}, detected: null })
    }),
    {
      name: 'concord-listening-prefs',
      partialize: (state) => ({ enabled: state.enabled })
    }
  )
)

/** Música que um usuário está ouvindo, ou null. */
export function useListening(userId: string | undefined): ListeningActivity | null {
  return useListeningStore((s) => (userId ? (s.byUser[userId] ?? null) : null))
}
