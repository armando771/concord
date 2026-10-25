import { request } from './client'

export interface MessageAuthor {
  id: string
  username: string
  display_name: string
  avatar_url?: string | null
}

export interface ReplyPreview {
  id: string
  author_id: string
  author?: MessageAuthor
  content: string
}

export interface ReactionSummary {
  emoji: string
  count: number
  user_ids: string[]
}

export interface PollAnswer {
  answer_id: number
  text: string
  emoji?: string | null
  image_url?: string | null
  count: number
  me_voted: boolean
}

export interface Poll {
  question: string
  answers: PollAnswer[]
  allow_multiselect: boolean
  expires_at: string
  ended_at?: string | null
  total_voters: number
}

export type AttachmentKind = 'image' | 'video' | 'audio'

export interface Attachment {
  id: string
  kind: AttachmentKind
  content_type: string
  filename: string
  size_bytes: number
  width?: number | null
  height?: number | null
  duration_ms?: number | null
}

export interface Message {
  id: string
  author_id: string
  author?: MessageAuthor
  channel_id?: string | null
  conversation_id?: string | null
  reply_to_id?: string | null
  reply_to?: ReplyPreview | null
  reactions?: ReactionSummary[]
  content: string
  /** Mensagem do próprio servidor (ex.: "birthday"). */
  system_kind?: string | null
  poll?: Poll | null
  attachments?: Attachment[] | null
  created_at: string
}

export interface PollAnswerInput {
  text: string
  emoji?: string
  image_url?: string
}

export interface CreatePollInput {
  question: string
  answers: PollAnswerInput[]
  duration_hours: number
  allow_multiselect: boolean
}

export const MESSAGE_LIMIT = 50

export function listChannelMessages(channelId: string, before?: string): Promise<Message[]> {
  const query = new URLSearchParams({ limit: String(MESSAGE_LIMIT) })
  if (before) query.set('before', before)
  return request<Message[]>(`/channels/${channelId}/messages?${query.toString()}`)
}

export function sendChannelMessage(
  channelId: string,
  content: string,
  attachmentIds: string[] = [],
  replyToId?: string | null
): Promise<Message> {
  return request<Message>(`/channels/${channelId}/messages`, {
    method: 'POST',
    body: JSON.stringify({
      content,
      attachment_ids: attachmentIds,
      ...(replyToId ? { reply_to_id: replyToId } : {})
    })
  })
}

export function deleteChannelMessage(channelId: string, messageId: string): Promise<void> {
  return request<void>(`/channels/${channelId}/messages/${messageId}`, { method: 'DELETE' })
}

export function addChannelReaction(
  channelId: string,
  messageId: string,
  emoji: string
): Promise<void> {
  return request<void>(`/channels/${channelId}/messages/${messageId}/reactions`, {
    method: 'POST',
    body: JSON.stringify({ emoji })
  })
}

export function removeChannelReaction(
  channelId: string,
  messageId: string,
  emoji: string
): Promise<void> {
  const query = new URLSearchParams({ emoji })
  return request<void>(
    `/channels/${channelId}/messages/${messageId}/reactions?${query.toString()}`,
    { method: 'DELETE' }
  )
}

export function listConversationMessages(
  conversationId: string,
  before?: string
): Promise<Message[]> {
  const query = new URLSearchParams({ limit: String(MESSAGE_LIMIT) })
  if (before) query.set('before', before)
  return request<Message[]>(`/conversations/${conversationId}/messages?${query.toString()}`)
}

export function sendConversationMessage(
  conversationId: string,
  content: string,
  attachmentIds: string[] = [],
  replyToId?: string | null
): Promise<Message> {
  return request<Message>(`/conversations/${conversationId}/messages`, {
    method: 'POST',
    body: JSON.stringify({
      content,
      attachment_ids: attachmentIds,
      ...(replyToId ? { reply_to_id: replyToId } : {})
    })
  })
}

export function deleteConversationMessage(
  conversationId: string,
  messageId: string
): Promise<void> {
  return request<void>(`/conversations/${conversationId}/messages/${messageId}`, {
    method: 'DELETE'
  })
}

export function addConversationReaction(
  conversationId: string,
  messageId: string,
  emoji: string
): Promise<void> {
  return request<void>(`/conversations/${conversationId}/messages/${messageId}/reactions`, {
    method: 'POST',
    body: JSON.stringify({ emoji })
  })
}

export function removeConversationReaction(
  conversationId: string,
  messageId: string,
  emoji: string
): Promise<void> {
  const query = new URLSearchParams({ emoji })
  return request<void>(
    `/conversations/${conversationId}/messages/${messageId}/reactions?${query.toString()}`,
    { method: 'DELETE' }
  )
}

/** Base da rota da sala: `/channels/:id` ou `/conversations/:id`. */
export function roomPath(room: string): string {
  return room.startsWith('channel:')
    ? `/channels/${room.slice('channel:'.length)}`
    : `/conversations/${room.slice('conversation:'.length)}`
}

export function createPoll(room: string, input: CreatePollInput): Promise<Message> {
  return request<Message>(`${roomPath(room)}/polls`, {
    method: 'POST',
    body: JSON.stringify(input)
  })
}

/** Troca o voto pelas respostas dadas; lista vazia remove o voto. */
export function votePoll(room: string, messageId: string, answerIds: number[]): Promise<Poll> {
  return request<Poll>(`${roomPath(room)}/messages/${messageId}/poll/votes`, {
    method: 'PUT',
    body: JSON.stringify({ answer_ids: answerIds })
  })
}

export function endPoll(room: string, messageId: string): Promise<Poll> {
  return request<Poll>(`${roomPath(room)}/messages/${messageId}/poll/end`, { method: 'POST' })
}
