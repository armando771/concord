import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { sanitizeActivity, type PresenceActivity } from '../lib/presenceActivity'
import { useAuthStore } from '../../auth/store/authStore'
import { useCallStore } from '../../call/store/callStore'
import { useChatStore } from '../../chat/store/chatStore'
import { useListeningStore } from './listeningStore'

interface PresenceActivityState {
  /** Atividade de cada usuário (só quem o servidor deixa eu ver). */
  byUser: Record<string, PresenceActivity>
  /** Jogo detectado neste PC (só Windows), antes de ir ao servidor. */
  detected: { name: string; startedAt: number; appId?: number; iconHash?: string } | null
  /** Mostrar meu jogo aos outros (Configurações → Privacidade). */
  enabled: boolean
  setActivity: (userId: string, activity: PresenceActivity | null) => void
  /** Carga inicial: quem veio sem atividade na resposta deixa de ter. */
  applyFetched: (requestedIds: string[], fetched: Record<string, unknown>) => void
  setDetected: (
    game: { name: string; startedAt: number; appId?: number; iconHash?: string } | null
  ) => void
  setEnabled: (enabled: boolean) => void
  /** Manda ao servidor o que vale agora (também ao reconectar o WS). */
  publishMine: () => void
  reset: () => void
}

export const usePresenceActivityStore = create<PresenceActivityState>()(
  persist(
    (set, get) => ({
      byUser: {},
      detected: null,
      enabled: true,
      setActivity: (userId, activity) =>
        set((state) => {
          const next = { ...state.byUser }
          if (activity) next[userId] = activity
          else delete next[userId]
          return { byUser: next }
        }),
      applyFetched: (requestedIds, fetched) => {
        // A mesma resposta traz a música (campo listening).
        useListeningStore.getState().applyFetched(requestedIds, fetched)
        set((state) => {
          const next = { ...state.byUser }
          for (const id of requestedIds) {
            const activity = sanitizeActivity(fetched[id])
            if (activity) next[id] = activity
            else delete next[id]
          }
          return { byUser: next }
        })
      },
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
          sendEvent('activity:set', {
            name: detected.name,
            kind: 'game',
            started_at: detected.startedAt,
            ...(detected.appId && detected.iconHash
              ? { app_id: detected.appId, icon_hash: detected.iconHash }
              : {})
          })
        } else {
          sendEvent('activity:clear', {})
        }
      },
      reset: () => {
        useListeningStore.getState().reset()
        set({ byUser: {}, detected: null })
      }
    }),
    {
      name: 'concord-presence-activity-prefs',
      partialize: (state) => ({ enabled: state.enabled })
    }
  )
)

/** Atividade (jogo) de um usuário, ou null. */
export function useActivity(userId: string | undefined): PresenceActivity | null {
  return usePresenceActivityStore((s) => (userId ? (s.byUser[userId] ?? null) : null))
}

/** Está na chamada em andamento comigo (ou sou eu nela). */
export function useInVoice(userId: string): boolean {
  const meId = useAuthStore((s) => s.user?.id)
  const inCall = useCallStore((s) => s.status === 'active')
  const isParticipant = useCallStore((s) => s.participants.some((p) => p.id === userId))
  return inCall && (userId === meId || isParticipant)
}
