import type { Message } from '../../chat/api/messages'
import { splitMentions, type MentionLabels } from '../../chat/lib/mentions'
import { serverDisplayName } from '../../servers/lib/serverNames'

// O que a voz lê: "<nome> disse: <texto>", com @nick trocado pelo nome de
// exibição, links como "link" e sem emojis (a voz leria o nome de cada um).

export interface SpokenNames {
  /** Nome de cada @nick (mentionLabels: apelido no servidor ou nome de exibição). */
  labels: MentionLabels
  /** Apelido do autor no servidor, se tiver. */
  authorNickname?: string
}

const EVERYONE: Record<string, string> = { all: 'todo mundo', here: 'quem está online' }
const LINK = /\bhttps?:\/\/\S+|\bwww\.\S+/gi
const EMOJI = /\p{Extended_Pictographic}(?:️|‍\p{Extended_Pictographic})*/gu
const SHORTCODE = /:[a-z0-9_+-]{2,}:/gi

function mentionText(mention: string, labels: MentionLabels): string {
  return EVERYONE[mention] ?? labels[mention.toLowerCase()] ?? mention
}

function cleanText(text: string): string {
  return text.replace(LINK, 'link').replace(EMOJI, '').replace(SHORTCODE, '')
}

/** O texto que a voz lê para a mensagem. */
export function spokenText(
  msg: Pick<Message, 'content' | 'author' | 'mention_everyone'>,
  names: SpokenNames
): string {
  const body = splitMentions(msg.content, msg.mention_everyone ?? null)
    .map((part) => (part.mention ? mentionText(part.mention, names.labels) : cleanText(part.text)))
    .join('')
    .replace(/\s+/g, ' ')
    .trim()
  const author = serverDisplayName({ nickname: names.authorNickname }, msg.author)
  return `${author} disse: ${body}`
}
