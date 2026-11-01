import type { CallUserInfo } from '../../call/store/callStore'

// Botão de ligar do cabeçalho da DM.

export function dmCallButton(o: {
  online: boolean
  hasConversation: boolean
  callStatus: string
  blocked: boolean
}): { disabled: boolean; title: string } {
  const inCall = o.callStatus !== 'idle'
  return {
    disabled: !o.online || !o.hasConversation || inCall || o.blocked,
    title: inCall
      ? 'Você já está em uma chamada'
      : o.online
        ? 'Iniciar chamada de voz'
        : 'Usuário offline'
  }
}

/** Liga para a pessoa; sem conversa aberta ou sem pessoa na rota, não faz nada. */
export function startDmCall(
  start: (conversationId: string, peer: CallUserInfo) => Promise<void> | void,
  o: { conversationId: string | null; userId: string | undefined; handle: string; name: string }
): void {
  if (!o.conversationId || !o.userId) return
  void start(o.conversationId, { id: o.userId, username: o.handle, display_name: o.name })
}
