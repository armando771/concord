import type { Message } from '../api/messages'
import { useChatStore } from '../store/chatStore'
import { useReactionLimitStore } from '../store/reactionLimitStore'
import { showToast } from '../../../shared/store/toastStore'
import { actionErrorMessage } from '../../servers/lib/permissionErrors'
import { canAddReaction, isReactionLimitError } from '../lib/reactionLimit'

/** Falha ao reagir: o limite de reações (409 do servidor) abre o aviso; o resto vira toast. */
function reactionFailed(err: unknown): void {
  if (isReactionLimitError(err)) {
    useReactionLimitStore.getState().show()
    return
  }
  showToast.error(actionErrorMessage(err, 'Falha ao reagir à mensagem.'))
}

/**
 * Reage (ou tira a reação) com `emoji`. Uma 21ª reação diferente nem é
 * enviada: abre o aviso de "reações demais", como no Discord.
 */
export function reactWithLimit(
  message: Message,
  emoji: string,
  toggle: (emoji: string) => Promise<void>
): Promise<void> {
  if (!canAddReaction(message.reactions, emoji)) {
    useReactionLimitStore.getState().show()
    return Promise.resolve()
  }
  return toggle(emoji).catch(reactionFailed)
}

/**
 * Reagir numa mensagem da sala, venha do chip, da barra de ações ou do
 * seletor de emoji.
 */
export function useReactToMessage(room: string): (message: Message, emoji: string) => void {
  const toggleReaction = useChatStore((s) => s.toggleReaction)
  return (message, emoji) => {
    void reactWithLimit(message, emoji, (e) => toggleReaction(room, message.id, e))
  }
}
