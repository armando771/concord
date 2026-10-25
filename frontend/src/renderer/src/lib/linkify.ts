import type { MentionEveryone } from '../api/messages'
import { isSafeExternalUrl } from '../../../shared/externalUrl'
import { splitMentions, type MessagePart } from './mentions'

// Links clicáveis no texto das mensagens: http(s)://… e www.… viram <a>.
// Só gera http/https (www. vira https://), nunca javascript:/data:.

export interface LinkPart {
  text: string
  /** destino do link, se este pedaço é um link */
  href?: string
}

/** Pedaço do texto da mensagem: texto, menção (chip) ou link. */
export type RichPart = MessagePart & { href?: string }

/** Onde um link pode começar: http://, https:// ou www. (sem diferenciar maiúsculas). */
const START = /https?:\/\/|www\./giu

/**
 * O que vem antes precisa abrir uma palavra: começo, espaço ou pontuação.
 * Letra, número, "@", ".", "/", ":" ou "-" logo antes é pedaço de outra
 * coisa — e-mail (ana@www.x.com), @nick, outro link (javascript://https://…)
 * ou palavra (xhttps://).
 */
const GLUED_BEFORE = /[\p{L}\p{N}@./:_-]/u

/** O link acaba no primeiro espaço, aspas, crase ou < >. */
const STOP = /[\s<>"`“”‘’«»]/u

/** Pontuação que, no fim, é da frase e não do link. */
const TRAILING = ".,!?:;'*~"

/** Fecha → abre: só fica no fim se estiver balanceado dentro do link. */
const PAIRS: Record<string, string> = { ')': '(', ']': '[' }

function count(text: string, ch: string): number {
  let n = 0
  for (const c of text) if (c === ch) n++
  return n
}

/** Tira do fim a pontuação da frase: ".,!?" e o ")" que não abriu no link. */
function trimTrailing(candidate: string): string {
  let end = candidate.length
  while (end > 0) {
    const ch = candidate[end - 1]
    if (TRAILING.includes(ch)) {
      end--
      continue
    }
    const open = PAIRS[ch]
    if (open) {
      const body = candidate.slice(0, end)
      if (count(body, ch) > count(body, open)) {
        end--
        continue
      }
    }
    break
  }
  return candidate.slice(0, end)
}

/** O link tem um host de verdade (algo com letra ou número antes do caminho)? */
function hasHost(link: string): boolean {
  const rest = link.replace(/^https?:\/\//i, '')
  const authority = rest.split(/[/?#]/, 1)[0]
  const host = authority.slice(authority.lastIndexOf('@') + 1)
  return /[\p{L}\p{N}]/u.test(host) && !host.startsWith('.')
}

function hrefFor(link: string): string | null {
  const href = /^www\./i.test(link) ? `https://${link}` : link
  if (!hasHost(link) || /^www\.?$/i.test(link)) return null
  return isSafeExternalUrl(href) ? href : null
}

/**
 * Quebra o texto em pedaços normais e links. Pontuação final (".,!?" e um
 * ")" sem par no link) fica de fora; "(" e ")" balanceados ficam
 * (wikipedia.org/wiki/Rio_(cidade)). Juntando os pedaços volta o texto.
 */
export function linkify(text: string): LinkPart[] {
  const parts: LinkPart[] = []
  const pushText = (chunk: string): void => {
    if (!chunk) return
    const prev = parts[parts.length - 1]
    if (prev && !prev.href) prev.text += chunk
    else parts.push({ text: chunk })
  }

  let last = 0
  START.lastIndex = 0
  for (let match = START.exec(text); match; match = START.exec(text)) {
    const start = match.index
    // Último caractere antes do link (um emoji ocupa duas posições).
    const prevChar = Array.from(text.slice(Math.max(0, start - 2), start)).pop() ?? ''
    if (prevChar && GLUED_BEFORE.test(prevChar)) continue

    let end = start + match[0].length
    while (end < text.length && !STOP.test(text[end])) end++
    const link = trimTrailing(text.slice(start, end))
    const href = link.length > match[0].length ? hrefFor(link) : null
    if (!href) continue

    pushText(text.slice(last, start))
    parts.push({ text: link, href })
    last = start + link.length
    START.lastIndex = last
  }
  pushText(text.slice(last))
  return parts.length ? parts : [{ text }]
}

/**
 * Texto da mensagem pronto para desenhar: links primeiro (o "@" dentro de um
 * link não vira menção) e, no resto, as menções do splitMentions. Um link
 * nunca começa colado num "@nick", então não há link dentro de chip.
 */
export function messageParts(content: string, everyone: MentionEveryone | null): RichPart[] {
  const out: RichPart[] = []
  for (const part of linkify(content)) {
    if (part.href) out.push(part)
    else if (part.text) out.push(...splitMentions(part.text, everyone))
  }
  return out.length ? out : [{ text: content }]
}
