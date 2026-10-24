// Menções @nick no chat de texto.

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

/** Quebra o texto em pedaços normais e menções, para destacar. */
export function splitMentions(content: string): MessagePart[] {
  const parts: MessagePart[] = []
  const re = new RegExp(`(^|[^A-Za-z0-9_.@])@(${NICK})`, 'g')
  let last = 0
  for (let match = re.exec(content); match; match = re.exec(content)) {
    const start = match.index + match[1].length
    // não engole o ponto final ("@ana.")
    const nick = match[2].replace(/\.+$/, '')
    if (start > last) parts.push({ text: content.slice(last, start) })
    parts.push({ text: `@${nick}`, mention: nick })
    last = start + 1 + nick.length
    re.lastIndex = last
  }
  if (last < content.length) parts.push({ text: content.slice(last) })
  return parts.length ? parts : [{ text: content }]
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
