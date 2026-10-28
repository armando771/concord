import { request } from '../../../shared/api/client'

// Porte enxuto do api/messages do desktop: só o que o chat de texto usa nesta fatia.
export interface MessageAuthor {
  id: string
  username: string
  display_name: string
  avatar_url?: string | null
}

export interface Attachment {
  id: string
  filename?: string
}

export interface Message {
  id: string
  author_id: string
  author?: MessageAuthor
  channel_id?: string | null
  conversation_id?: string | null
  content: string
  attachments?: Attachment[] | null
  sticker_id?: string | null
  gif_url?: string | null
  created_at: string
  /** Quando o autor editou o texto pela última vez; ausente = nunca editada. */
  edited_at?: string | null
}

export const MESSAGE_LIMIT = 50

export function listChannelMessages(channelId: string, before?: string): Promise<Message[]> {
  const query = new URLSearchParams({ limit: String(MESSAGE_LIMIT) })
  if (before) query.set('before', before)
  return request<Message[]>(`/channels/${channelId}/messages?${query.toString()}`)
}

export function sendChannelMessage(channelId: string, content: string): Promise<Message> {
  return request<Message>(`/channels/${channelId}/messages`, {
    method: 'POST',
    body: JSON.stringify({ content, attachment_ids: [] })
  })
}

export function listConversationMessages(conversationId: string, before?: string): Promise<Message[]> {
  const query = new URLSearchParams({ limit: String(MESSAGE_LIMIT) })
  if (before) query.set('before', before)
  return request<Message[]>(`/conversations/${conversationId}/messages?${query.toString()}`)
}

export function sendConversationMessage(conversationId: string, content: string): Promise<Message> {
  return request<Message>(`/conversations/${conversationId}/messages`, {
    method: 'POST',
    body: JSON.stringify({ content, attachment_ids: [] })
  })
}
