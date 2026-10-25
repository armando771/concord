import { request } from './client'

export interface MessageAuthor {
  id: string
  username: string
  display_name: string
  avatar_url?: string | null
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
  content: string
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
  attachmentIds: string[] = []
): Promise<Message> {
  return request<Message>(`/channels/${channelId}/messages`, {
    method: 'POST',
    body: JSON.stringify({ content, attachment_ids: attachmentIds })
  })
}

export function deleteChannelMessage(channelId: string, messageId: string): Promise<void> {
  return request<void>(`/channels/${channelId}/messages/${messageId}`, { method: 'DELETE' })
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
  attachmentIds: string[] = []
): Promise<Message> {
  return request<Message>(`/conversations/${conversationId}/messages`, {
    method: 'POST',
    body: JSON.stringify({ content, attachment_ids: attachmentIds })
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
