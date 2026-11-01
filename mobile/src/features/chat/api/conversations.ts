import { request } from '../../../shared/api/client'

// Porte enxuto do api/conversations do desktop: lista, abrir DM e marcar como lida.
export type ConversationType = 'dm' | 'group'

export interface ConversationPerson {
  id: string
  username: string
  display_name: string
  avatar_url?: string | null
}

export interface ConversationLastMessage {
  id: string
  author_id: string
  content: string
  created_at: string
}

export interface ConversationSummary {
  id: string
  type: ConversationType
  /** Nome do grupo ('' = mostra os nomes dos participantes). */
  name: string
  icon_url?: string | null
  /** Só na DM 1 a 1. */
  other_user?: ConversationPerson
  /** Todos os participantes, inclusive você. */
  members: ConversationPerson[]
  last_message?: ConversationLastMessage
  unread_count: number
  created_at: string
  updated_at: string
}

// include_groups=1: este app sabe mostrar DM em grupo; sem isso o servidor só manda as 1 a 1.
export function listConversations(): Promise<ConversationSummary[]> {
  return request<ConversationSummary[]>('/conversations?include_groups=1')
}

export function getOrCreateConversationWith(userId: string): Promise<{ id: string }> {
  return request<{ id: string }>(`/conversations/with/${userId}`)
}

export function markConversationRead(id: string, messageId?: string): Promise<void> {
  return request<void>(`/conversations/${id}/read`, {
    method: 'POST',
    body: JSON.stringify(messageId ? { message_id: messageId } : {})
  })
}
