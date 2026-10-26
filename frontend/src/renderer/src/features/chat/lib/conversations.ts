import type { ConversationOtherUser, ConversationSummary } from '../api/conversations'
import { isRecord, keepWithId } from '../../../shared/lib/listGuards'

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
  const name = typeof conv.name === 'string' ? conv.name.trim() : ''
  if (name) return name
  const others = otherMembers(conv, meId)
  return others.length > 0 ? others.map(nameOf).join(', ') : 'Grupo sem nome'
}

/** Rota da conversa: DM 1:1 pelo id da pessoa; grupo pelo id da conversa. */
export function conversationRoute(conv: ConversationLike, meId: string | undefined): string {
  if (conv.type === 'group') return `/dm/c/${conv.id}`
  const other = conv.other_user ?? otherMembers(conv, meId)[0]
  return other ? `/dm/${other.id}` : `/dm/c/${conv.id}`
}

/**
 * Lista de conversas do servidor no formato que as telas esperam: linhas sem
 * id somem, members sempre é lista (só com quem tem id), other_user sem id
 * vira undefined e a DM 1:1 sem ninguém do outro lado ainda aparece (cai no
 * ícone/rota da conversa em vez de quebrar).
 */
export function sanitizeConversations(raw: unknown): ConversationSummary[] {
  return keepWithId<Record<string, unknown>>(raw, 'id', 'conversations').map((c) => {
    const other = c.other_user
    return {
      ...c,
      type: c.type === 'group' ? 'group' : 'dm',
      name: typeof c.name === 'string' ? c.name : '',
      members: keepWithId<ConversationOtherUser>(c.members, 'id', 'conversations.members'),
      other_user:
        isRecord(other) && typeof other.id === 'string' && other.id
          ? (other as unknown as ConversationOtherUser)
          : undefined,
      unread_count: typeof c.unread_count === 'number' ? c.unread_count : 0
    } as ConversationSummary
  })
}
