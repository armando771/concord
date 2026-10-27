import { create } from 'zustand'
import { fetchInviteValid } from '../api/callInvites'
import type { InviteValidity } from '../lib/callInviteCard'

// Se a call de cada cartão de convite (na DM) ainda existe. Mensagem antiga
// pergunta ao servidor ao aparecer; o call:invite_ended derruba na hora.
// Fica fora do callStore de propósito.

interface InviteValidityState {
  byCall: Record<string, Exclude<InviteValidity, 'unknown'>>
  /** Pergunta ao servidor (uma vez por call, mesmo com vários cartões). */
  ensure: (callId: string) => Promise<void>
  markInvalid: (callId: string) => void
}

const inFlight = new Map<string, Promise<void>>()

export const useInviteValidityStore = create<InviteValidityState>()((set, get) => ({
  byCall: {},
  ensure: (callId) => {
    if (get().byCall[callId]) return Promise.resolve()
    const pending = inFlight.get(callId)
    if (pending) return pending
    const run = fetchInviteValid(callId)
      // Sem resposta (rede): trata como válida; "Abrir" confere de novo no servidor.
      .catch(() => true)
      .then((valid) => {
        // Se o fim da call chegou por WS enquanto perguntava, ele vale mais.
        if (get().byCall[callId] === 'invalid') return
        set((s) => ({ byCall: { ...s.byCall, [callId]: valid ? 'valid' : 'invalid' } }))
      })
      .finally(() => inFlight.delete(callId))
    inFlight.set(callId, run)
    return run
  },
  markInvalid: (callId) => set((s) => ({ byCall: { ...s.byCall, [callId]: 'invalid' } }))
}))

/** Validade de uma call para o cartão ('unknown' enquanto pergunta). */
export function useInviteValidity(callId: string): InviteValidity {
  return useInviteValidityStore((s) => s.byCall[callId] ?? 'unknown')
}
