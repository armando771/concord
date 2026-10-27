import type { Message } from '../api/messages'
import { useChatStore } from '../store/chatStore'
import { showToast } from '../../../shared/store/toastStore'
import { actionErrorMessage } from '../../servers/lib/permissionErrors'

/**
 * Reagir (ou tirar a reação) numa mensagem da sala, venha do chip, da barra
 * de ações ou do seletor de emoji. Falha vira aviso.
 */
export function useReactToMessage(room: string): (message: Message, emoji: string) => void {
  const toggleReaction = useChatStore((s) => s.toggleReaction)
  return (message, emoji) => {
    toggleReaction(room, message.id, emoji).catch((err: unknown) =>
      showToast.error(actionErrorMessage(err, 'Falha ao reagir à mensagem.'))
    )
  }
}
