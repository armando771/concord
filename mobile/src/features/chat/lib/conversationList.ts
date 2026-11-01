import type { ConversationPerson, ConversationSummary } from '../api/conversations'
import type { Message } from '../api/messages'

/** Título da conversa: DM = nome do outro; grupo = nome do grupo ou os nomes dos outros membros. */
export function conversationTitle(c: ConversationSummary, myId: string | undefined): string {
  if (c.type === 'dm') return c.other_user?.display_name ?? 'Conversa'
  if (c.name) return c.name
  return c.members
    .filter((m) => m.id !== myId)
    .map((m) => m.display_name)
    .join(', ')
}

/** "N membros" no grupo; a DM 1 a 1 não tem subtítulo. */
export function conversationSubtitle(c: ConversationSummary): string | null {
  return c.type === 'group' ? `${c.members.length} membros` : null
}

const activityOf = (c: ConversationSummary): string => c.last_message?.created_at ?? c.updated_at

/** Mais recente primeiro (última mensagem; sem ela, a atualização). */
export function sortConversations(list: ConversationSummary[]): ConversationSummary[] {
  return [...list].sort((a, b) => (activityOf(a) < activityOf(b) ? 1 : -1))
}

/** Aplica uma mensagem nova à lista: atualiza a última e sobe a conversa. `unknown` = refazer a busca. */
export function applyMessage(list: ConversationSummary[], message: Message): { list: ConversationSummary[]; unknown: boolean } {
  const conversationId = message.conversation_id
  if (!conversationId) return { list, unknown: false }
  if (!list.some((c) => c.id === conversationId)) return { list, unknown: true }
  const updated = list.map((c) =>
    c.id === conversationId
      ? {
          ...c,
          updated_at: message.created_at,
          last_message: {
            id: message.id,
            author_id: message.author_id,
            content: message.content,
            created_at: message.created_at
          }
        }
      : c
  )
  return { list: sortConversations(updated), unknown: false }
}

const mapOne = (list: ConversationSummary[], id: string, change: (c: ConversationSummary) => ConversationSummary): ConversationSummary[] =>
  list.map((c) => (c.id === id ? change(c) : c))

/** +1 não lida na conversa. */
export const bumpUnread = (list: ConversationSummary[], id: string): ConversationSummary[] =>
  mapOne(list, id, (c) => ({ ...c, unread_count: c.unread_count + 1 }))

/** Zera a não lida da conversa (devolve a mesma lista se já estava zerada). */
export function clearUnread(list: ConversationSummary[], id: string): ConversationSummary[] {
  if (!list.some((c) => c.id === id && c.unread_count > 0)) return list
  return mapOne(list, id, (c) => ({ ...c, unread_count: 0 }))
}

/** Minúsculas e sem acento: "José" casa com "jose". */
const normalize = (text: string): string =>
  text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()

/** Filtra pelo nome (grupo: nome do grupo ou nomes dos membros). */
export function filterConversations(list: ConversationSummary[], query: string, myId: string | undefined): ConversationSummary[] {
  const q = normalize(query)
  if (!q) return list
  return list.filter((c) => {
    const haystack = c.type === 'group' ? `${c.name} ${c.members.map((m) => m.display_name).join(' ')}` : conversationTitle(c, myId)
    return normalize(haystack).includes(q)
  })
}

/** Amigos que casam com o texto e ainda não têm DM 1 a 1 (só com texto digitado). */
export function friendsWithoutConversation(
  friends: ConversationPerson[],
  list: ConversationSummary[],
  query: string
): ConversationPerson[] {
  const q = normalize(query)
  if (!q) return []
  const withDm = new Set(list.map((c) => c.other_user?.id).filter(Boolean))
  return friends.filter((f) => !withDm.has(f.id) && normalize(`${f.display_name} ${f.username}`).includes(q))
}

/** Ids dos outros usuários das DMs 1 a 1 (são os que mostram a bolinha de presença). */
export function peerIds(list: ConversationSummary[]): string[] {
  return list.flatMap((c) => (c.type === 'dm' && c.other_user ? [c.other_user.id] : []))
}
