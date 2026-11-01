import { create } from 'zustand'
import type { CallUser } from '../lib/callTypes'

/** Chamada de DM tocando para mim (com o app aberto ou aberta pelo toque no push). */
export interface IncomingCall {
  callId: string
  conversationId: string | null
  initiator: CallUser
}

interface IncomingCallState {
  call: IncomingCall | null
  ring: (call: IncomingCall) => void
  clear: () => void
}

export const useIncomingCallStore = create<IncomingCallState>()((set) => ({
  call: null,
  ring: (call) => set({ call }),
  clear: () => set({ call: null })
}))
