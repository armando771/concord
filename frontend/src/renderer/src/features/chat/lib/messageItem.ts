/**
 * O que uma linha de mensagem do chat (MessageItem) mostra, derivado da
 * mensagem: nome provisório do autor, aviso de figurinha, classes da linha e
 * quais ações da barra valem para quem está vendo.
 */
import type { Message } from '../api/messages'
import { canEditMessage } from './messageEdit'

interface Me {
  id: string
  display_name?: string | null
}

/** Nome do autor antes do perfil chegar: o da mensagem, o meu (se for minha) ou "Desconhecido". */
export function authorFallbackName(message: Message, me: Me | null | undefined): string {
  const author = message.author
  const mine = message.author_id === me?.id
  return (
    author?.display_name ?? author?.username ?? (mine ? me?.display_name : null) ?? 'Desconhecido'
  )
}

/** Tem referência de resposta (mesmo que a original tenha sido apagada). */
export function hasReplyReference(message: Message): boolean {
  return Boolean(message.reply_to_id || message.reply_to)
}

/**
 * Sem a figurinha carregada: aviso de "Figurinha indisponível" (figurinha
 * apagada, ou mensagem sem nada para mostrar).
 */
export function stickerUnavailable(message: Message): boolean {
  if (message.sticker) return false
  return Boolean(
    message.sticker_id ||
    (!message.content &&
      !message.gif_url &&
      !message.attachments?.length &&
      !message.poll &&
      !message.system_kind)
  )
}

/** Classes da linha: espaço (agrupada ou não), destaque de menção e pulso do pulo. */
export function messageRowClass(
  compact: boolean,
  mentionsMe: boolean,
  highlighted: boolean
): string {
  const spacing = compact ? 'py-0.5' : 'py-1.5'
  const mention = mentionsMe
    ? 'border-l-2 border-warning bg-warning/10 hover:bg-warning/15'
    : 'hover:bg-fg/[0.03]'
  const jump = highlighted ? 'msg-jump-highlight' : ''
  return `group relative flex flex-col gap-1 rounded-md px-4 transition-colors ${spacing} ${mention} ${jump}`
}

export interface MessageBarInput {
  message: Message
  meId: string | null | undefined
  isEditing: boolean
  /** Em canais de sistema (#avisos e #musica) nada pode ser excluído. */
  canDelete: boolean
  /** MANAGE_MESSAGES: apaga mensagem dos outros. */
  canModerate: boolean
}

export interface MessageBarHandlers {
  onCopy: () => void
  onStartEdit: () => void
  onDelete: () => void
}

export interface MessageBarActions {
  onCopy?: () => void
  onEdit?: () => void
  onDelete?: () => void
  deleteTitle: string
}

/**
 * Ações de texto/edição/exclusão da barra: cada handler só vai quando a ação
 * vale (copiar sem texto, editar de outro autor, excluir sem permissão ficam
 * de fora).
 */
export function messageBarActions(
  input: MessageBarInput,
  handlers: MessageBarHandlers
): MessageBarActions {
  const { message, meId } = input
  const isMine = message.author_id === meId
  const canEdit = canEditMessage(message, meId) && !input.isEditing
  const canDelete = input.canDelete && (isMine || input.canModerate)
  return {
    onCopy: message.content ? handlers.onCopy : undefined,
    onEdit: canEdit ? handlers.onStartEdit : undefined,
    onDelete: canDelete ? handlers.onDelete : undefined,
    deleteTitle: isMine ? 'Excluir mensagem' : 'Excluir mensagem (moderação)'
  }
}
