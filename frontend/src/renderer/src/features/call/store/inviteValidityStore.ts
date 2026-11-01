import { create } from 'zustand'
import { fetchInviteValid } from '../api/callInvites'
import type { InviteValidity } from '../lib/callInviteCard'

// Se cada cartão de convite (na DM) ainda vale para quem está vendo. Mensagem
// antiga pergunta ao servidor ao aparecer; o call:invite_ended derruba na hora
// (call acabada: todos os cartões; convite usado: só os de convidado). Cada
// mensagem pergunta a sua vez, então um convite novo vale mesmo depois de um
// uso. Fica fora do callStore de propósito.

export type InviteRole = 'inviter' | 'invitee'

export interface InviteCardRef {
  callId: string
  messageId: string
  role: InviteRole
}

interface InviteValidityState {
  byKey: Record<string, Exclude<InviteValidity, 'unknown'>>
  /** Pergunta ao servidor (uma vez por cartão). */
  ensure: (card: InviteCardRef) => Promise<void>
  /** Sem `role`, vale para os dois papéis (a call acabou). */
  markInvalid: (callId: string, role?: InviteRole) => void
}

const keyOf = (c: InviteCardRef): string => `${c.callId}:${c.role}:${c.messageId}`
const matches = (key: string, callId: string, role?: InviteRole): boolean =>
  key.startsWith(`${callId}:${role ?? ''}`)

const inFlight = new Map<string, Promise<void>>()

export const useInviteValidityStore = create<InviteValidityState>()((set, get) => ({
  byKey: {},
  ensure: (card) => {
    const key = keyOf(card)
    if (get().byKey[key]) return Promise.resolve()
    const pending = inFlight.get(key)
    if (pending) return pending
    const run = fetchInviteValid(card.callId, card.role)
      // Sem resposta (rede): trata como válida; "Abrir" confere de novo no servidor.
      .catch(() => true)
      .then((valid) => {
        // Se o fim da call chegou por WS enquanto perguntava, ele vale mais.
        if (get().byKey[key] === 'invalid') return
        set((s) => ({ byKey: { ...s.byKey, [key]: valid ? 'valid' : 'invalid' } }))
      })
      .finally(() => inFlight.delete(key))
    inFlight.set(key, run)
    return run
  },
  markInvalid: (callId, role) =>
    set((s) => {
      const next = { ...s.byKey }
      // Inclui os que ainda esperam a resposta do servidor.
      const keys = [...Object.keys(next), ...inFlight.keys()]
      for (const key of keys) if (matches(key, callId, role)) next[key] = 'invalid'
      return { byKey: next }
    })
}))

/** Validade de um cartão ('unknown' enquanto pergunta). */
export function useInviteValidity(card: InviteCardRef): InviteValidity {
  return useInviteValidityStore((s) => s.byKey[keyOf(card)] ?? 'unknown')
}
