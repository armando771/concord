import type { ConversationOtherUser, ConversationSummary } from '../api/conversations'

type ConversationLike = Pick<ConversationSummary, 'id' | 'type' | 'name'> & {
  members?: ConversationOtherUser[]
  other_user?: ConversationOtherUser
}

const nameOf = (u: ConversationOtherUser): string => u.display_name || u.username

/** Participantes tirando você. */
export function otherMembers(
  conv: ConversationLike,
  meId: string | undefined
): ConversationOtherUser[] {
  return (conv.members ?? []).filter((m) => m.id !== meId)
}

/**
 * Nome mostrado na lista e no topo: o do grupo, ou (sem nome) os nomes dos
 * outros participantes, como no Discord. Na DM 1:1, o nome da pessoa.
 */
export function conversationTitle(conv: ConversationLike, meId: string | undefined): string {
  if (conv.type !== 'group') {
    const other = conv.other_user ?? otherMembers(conv, meId)[0]
    return other ? nameOf(other) : 'Mensagem direta'
  }
  if (conv.name.trim()) return conv.name.trim()
  const others = otherMembers(conv, meId)
  return others.length > 0 ? others.map(nameOf).join(', ') : 'Grupo sem nome'
}

/** Rota da conversa: DM 1:1 pelo id da pessoa; grupo pelo id da conversa. */
export function conversationRoute(conv: ConversationLike, meId: string | undefined): string {
  if (conv.type === 'group') return `/dm/c/${conv.id}`
  const other = conv.other_user ?? otherMembers(conv, meId)[0]
  return other ? `/dm/${other.id}` : `/dm/c/${conv.id}`
}
