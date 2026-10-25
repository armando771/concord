import type { Message, MentionEveryone } from '../api/messages'
import type { ChosenStatus } from './presenceStatus'

// Menções @nick no chat de texto, mais @all/@here (menção em massa num canal
// de servidor). Quem decide se @all/@here pinga é o backend, no campo
// mention_everyone da mensagem; o texto sozinho não pinga ninguém.

const NICK = '[A-Za-z0-9_.]+'

function escape(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/** A mensagem menciona este @nick (sem diferenciar maiúsculas)? */
export function mentionsUser(content: string, username: string): boolean {
  if (!username) return false
  return new RegExp(`(^|[^A-Za-z0-9_.@])@${escape(username)}(?![A-Za-z0-9_])`, 'i').test(content)
}

export interface MessagePart {
  text: string
  /** nick mencionado, se este pedaço é uma menção */
  mention?: string
}

const EVERYONE: readonly MentionEveryone[] = ['all', 'here']

function isEveryone(nick: string): nick is MentionEveryone {
  return (EVERYONE as readonly string[]).includes(nick)
}

/**
 * Quebra o texto em pedaços normais e menções, para destacar. @all/@here só
 * viram menção quando batem com o mention_everyone da mensagem; senão ficam
 * como texto puro.
 */
export function splitMentions(
  content: string,
  everyone: MentionEveryone | null = null
): MessagePart[] {
  const parts: MessagePart[] = []
  const pushText = (text: string): void => {
    const prev = parts[parts.length - 1]
    if (prev && !prev.mention) prev.text += text
    else parts.push({ text })
  }
  const re = new RegExp(`(^|[^A-Za-z0-9_.@])@(${NICK})`, 'g')
  let last = 0
  for (let match = re.exec(content); match; match = re.exec(content)) {
    const start = match.index + match[1].length
    // não engole o ponto final ("@ana.")
    const nick = match[2].replace(/\.+$/, '')
    const lower = nick.toLowerCase()
    if (start > last) pushText(content.slice(last, start))
    if (isEveryone(lower)) {
      if (lower === everyone) parts.push({ text: `@${nick}`, mention: lower })
      else pushText(`@${nick}`)
    } else {
      parts.push({ text: `@${nick}`, mention: nick })
    }
    last = start + 1 + nick.length
    re.lastIndex = last
  }
  if (last < content.length) pushText(content.slice(last))
  return parts.length ? parts : [{ text: content }]
}

/**
 * Um @all/@here (já liberado pelo backend) pinga quem tem este status? @all
 * pinga todo mundo; @here só quem aparece online — ausente e invisível
 * (que os outros veem offline) ficam de fora. Sem status conhecido, estar
 * conectado já é estar online.
 */
export function everyonePingsMe(
  everyone: MentionEveryone | null | undefined,
  status: ChosenStatus | undefined
): boolean {
  if (everyone === 'all') return true
  if (everyone === 'here') return status !== 'idle' && status !== 'invisible'
  return false
}

/**
 * A linha da mensagem ganha o destaque de "mencionou você"? @nick, resposta a
 * uma mensagem sua ou @all/@here liberados. No histórico não dá para saber o
 * status de quando a mensagem chegou, então @here destaca para todos.
 */
export function messageMentionsMe(
  message: Pick<Message, 'author_id' | 'content' | 'mention_everyone'> & {
    reply_to?: { author_id: string } | null
  },
  me: { id: string; username: string } | null | undefined
): boolean {
  if (!me || message.author_id === me.id) return false
  return (
    mentionsUser(message.content, me.username) ||
    message.reply_to?.author_id === me.id ||
    Boolean(message.mention_everyone)
  )
}

export interface EveryoneSuggestion {
  username: MentionEveryone
  description: string
}

const EVERYONE_SUGGESTIONS: EveryoneSuggestion[] = [
  { username: 'all', description: 'Notifica todos do canal' },
  { username: 'here', description: 'Notifica quem está online' }
]

/** Sugestões de @all/@here no autocompletar — só para dono e moderadores. */
export function everyoneSuggestions(query: string, allowed: boolean): EveryoneSuggestion[] {
  if (!allowed) return []
  const q = query.toLowerCase()
  return EVERYONE_SUGGESTIONS.filter((s) => s.username.startsWith(q))
}

/** "@xx" sendo digitado logo antes do cursor → o que buscar e onde começa. */
export function mentionQuery(
  draft: string,
  caret: number
): { query: string; start: number } | null {
  const before = draft.slice(0, caret)
  const match = new RegExp(`(^|\\s)@(${NICK})?$`).exec(before)
  if (!match) return null
  return { query: match[2] ?? '', start: match.index + match[1].length }
}

/** Troca o "@xx" digitado por "@nick " e devolve a nova posição do cursor. */
export function applyMention(
  draft: string,
  start: number,
  caret: number,
  username: string
): { text: string; caret: number } {
  const insert = `@${username} `
  return { text: draft.slice(0, start) + insert + draft.slice(caret), caret: start + insert.length }
}
