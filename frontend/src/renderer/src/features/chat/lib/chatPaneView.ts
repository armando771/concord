/**
 * O que a tela do chat (ChatPane) mostra, derivado do estado: aviso no lugar
 * do campo, menu de menções, nomes, prévia da fixada e rótulos do campo.
 */
import type { Message, PinnedMessage } from '../api/messages'
import { serverDisplayName } from '../../servers/lib/serverNames'
import { sendDeniedReason, type ChatPermissions } from './chatPermissions'
import { mentionSuggestions, type MentionSuggestion, type UserSuggestionInput } from './mentions'
import { MUSIC_COMMANDS, type SlashSuggestion } from '../../music/lib/music'
import { TTS_SUGGESTION } from '../../tts/lib/ttsCommand'

/** Id do canal de uma sala `channel:<id>`; DM e grupo não têm (null). */
export function channelIdOf(room: string): string | null {
  return room.startsWith('channel:') ? room.slice('channel:'.length) : null
}

/** Aviso no lugar do campo: o da tela (ex.: DM bloqueada) ou, sem SEND_MESSAGES, o de permissão. */
export function composerDisabledReason(
  explicit: string | undefined,
  permissions: ChatPermissions
): string | undefined {
  return explicit ?? sendDeniedReason(permissions)
}

/**
 * Campo de um estado guardado por sala (edição, resposta): o ServerView
 * reaproveita o ChatPane entre canais, então o de outra sala não vale aqui.
 */
export function inRoom<S extends { room: string }, K extends keyof S>(
  state: S | null,
  room: string,
  key: K
): S[K] | null {
  return state?.room === room ? state[key] : null
}

/**
 * Sugestões do @ em digitação e o item destacado. Tab/Enter pegam o item
 * padrão (sempre uma pessoa, se houver) até a pessoa navegar com as setas.
 */
export function mentionMenu(
  mention: { query: string; start: number } | null,
  highlightChoice: number | null,
  users: UserSuggestionInput[],
  canMentionEveryone: boolean,
  exclude: string | undefined,
  max: number
): { suggestions: MentionSuggestion[]; highlight: number } {
  if (!mention) return { suggestions: [], highlight: -1 }
  const { items, defaultIndex } = mentionSuggestions(mention.query, users, canMentionEveryone, {
    exclude,
    max
  })
  return { suggestions: items, highlight: highlightChoice ?? defaultIndex }
}

/** Nome do autor da mensagem: em servidor, o apelido de lá; senão, o nome de exibição. */
export function messageAuthorName(
  message: Pick<Message, 'author_id' | 'author'> | null | undefined,
  nicknames: Record<string, string> | undefined
): string {
  const nickname = message ? nicknames?.[message.author_id] : undefined
  return serverDisplayName({ nickname }, message?.author)
}

const ATTACHMENT_PREVIEW: Record<string, string> = {
  image: '📷 Imagem',
  video: '🎥 Vídeo',
  audio: '🎵 Áudio'
}

function attachmentPreview(pin: PinnedMessage): string | null {
  const first = pin.attachments?.[0]
  if (!first) return null
  return ATTACHMENT_PREVIEW[first.kind] ?? '📎 Anexo'
}

function richPreview(pin: PinnedMessage): string | null {
  if (pin.sticker) return `💟 Figurinha :${pin.sticker.name}:`
  return pin.gif_url ? '👾 GIF' : null
}

/** Prévia da mensagem fixada na barra do topo do canal. */
export function pinnedPreview(pin: PinnedMessage): string {
  return (
    richPreview(pin) ||
    pin.content?.trim() ||
    attachmentPreview(pin) ||
    (pin.poll ? '📊 Enquete: ' + pin.poll.question : 'Mensagem fixada')
  )
}

/** "+N fixada(s)" ao lado da mais recente; null quando ela é a única. */
export function morePinsLabel(count: number): string | null {
  const others = count - 1
  if (others < 1) return null
  return `+${others} fixada${others > 1 ? 's' : ''}`
}

/** Texto do campo vazio: respondendo, chama a pessoa; senão, o da tela. */
export function composerPlaceholder(replying: boolean, author: string, fallback: string): string {
  return replying ? `Responder a @${author}...` : fallback
}

/**
 * Pedido de pulo da busca: a mensagem a buscar quando o pedido é desta sala
 * e ela já carregou; null enquanto não.
 */
export function readyJump(
  pending: { room: string; messageId: string } | null,
  room: string,
  loading: boolean
): string | null {
  if (!pending || loading) return null
  return pending.room === room ? pending.messageId : null
}

/** Mensagem pedida pelo evento `concord:jump-to-message` (null: sem mensagem). */
export function jumpEventTarget(e: Event): string | null {
  return (e as CustomEvent<{ messageId?: string } | null>).detail?.messageId || null
}

/** Rótulo do botão de enviar. */
export function submitLabel(uploading: boolean, sending: boolean): string {
  if (uploading) return 'Enviando arquivos...'
  return sending ? 'Enviando...' : 'Enviar'
}

/** Comandos do "/" no campo: Maestro só em canal de servidor; /tts com a permissão. */
export function composerCommands(isChannel: boolean, canSendTTS: boolean): SlashSuggestion[] {
  return [...(isChannel ? MUSIC_COMMANDS : []), ...(canSendTTS ? [TTS_SUGGESTION] : [])]
}
