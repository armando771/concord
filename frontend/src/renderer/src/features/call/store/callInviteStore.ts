import { create } from 'zustand'
import {
  sendCallInvites,
  type InviteResult,
  type InviteUpdate,
  type InviteUpdateStatus,
  type ReceivedInvite
} from '../api/callInvites'
import { INVITE_COPY } from '../lib/callInviteCopy'

// Convites de amigos para a call: os que recebi, o estado dos que enviei e o
// envio em andamento. Fica fora do callStore de propósito.

export type SendPhase = 'idle' | 'loading' | 'ok' | 'error'

interface CallInviteState {
  received: ReceivedInvite[]
  /** `${callId}:${userId}` -> como o convidado respondeu (tempo real). */
  sentStatus: Record<string, InviteUpdateStatus>
  phase: SendPhase
  results: InviteResult[]
  error: string | null
  addReceived: (invite: ReceivedInvite) => void
  removeReceived: (callId: string) => void
  markSent: (update: InviteUpdate) => void
  send: (callId: string, userIds: string[]) => Promise<void>
  resetSend: () => void
}

export const sentKey = (callId: string, userId: string): string => `${callId}:${userId}`

export const useCallInviteStore = create<CallInviteState>()((set) => ({
  received: [],
  sentStatus: {},
  phase: 'idle',
  results: [],
  error: null,
  // Convite novo da mesma call substitui o anterior (um cartão por call).
  addReceived: (invite) =>
    set((s) => ({
      received: [...s.received.filter((r) => r.call_id !== invite.call_id), invite]
    })),
  removeReceived: (callId) =>
    set((s) => ({ received: s.received.filter((r) => r.call_id !== callId) })),
  markSent: (update) =>
    set((s) => ({
      sentStatus: { ...s.sentStatus, [sentKey(update.call_id, update.user_id)]: update.status }
    })),
  send: async (callId, userIds) => {
    set({ phase: 'loading', error: null, results: [] })
    try {
      const results = await sendCallInvites(callId, userIds)
      set({ phase: 'ok', results })
    } catch (err) {
      const message = err instanceof Error && err.message ? err.message : INVITE_COPY.requestFailed
      set({ phase: 'error', error: message })
    }
  },
  resetSend: () => set({ phase: 'idle', results: [], error: null })
}))
