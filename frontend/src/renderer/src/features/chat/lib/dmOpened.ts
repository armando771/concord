// Resultado de abrir a DM, guardado junto da pessoa para quem foi pedido. A rota
// /dm/:userId reaproveita a mesma tela ao trocar de pessoa; sem este vínculo, a
// conversa (ou o erro) da pessoa anterior continuava valendo até a nova chegar.

export interface DmOpened {
  userId: string
  conversationId: string | null
  error: string | null
}

export interface DmOpenState {
  conversationId: string | null
  error: string | null
}

const OPENING: DmOpenState = { conversationId: null, error: null }

export function dmOpened(userId: string, conversationId: string): DmOpened {
  return { userId, conversationId, error: null }
}

export function dmFailed(userId: string, error: string): DmOpened {
  return { userId, conversationId: null, error }
}

/** O que vale para `userId`: o guardado, só se for dele; senão, ainda abrindo. */
export function dmOpenedFor(opened: DmOpened | null, userId: string | undefined): DmOpenState {
  if (!opened || opened.userId !== userId) return OPENING
  return { conversationId: opened.conversationId, error: opened.error }
}
