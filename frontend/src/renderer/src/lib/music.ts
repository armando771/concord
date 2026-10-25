import type { MusicItem } from '../api/music'

// Mesmo UUID da migration 000029 (backend/internal/bot).
export const MAESTRO_USER_ID = '4d414553-5452-4f00-8000-000000000001'
export const MAESTRO_NAME = 'Maestro'

export const isMaestroIdentity = (id: string): boolean => id.startsWith('bot-music:')
export const isMaestroUser = (id: string): boolean =>
  id === MAESTRO_USER_ID || isMaestroIdentity(id)

// Textos aprovados (spec, seção 7). Não alterar sem aprovação.
export const T14_LABEL = '👁️ Só você vê esta mensagem'
export const T14_DISMISS = 'Dispensar'
export const T16_TITLE = (q: string): string =>
  `🔎 Resultados para "${q}": clique para adicionar à fila`
export const T17 = {
  title: 'Tocando agora',
  next: 'Próximas',
  skip: 'Pular',
  vote: (votes: number, needed: number): string => `Votar para pular · ${votes}/${needed}`,
  ducking: 'Abaixar música quando alguém fala',
  empty: 'Nada na fila. Use /play'
}
export const T18 = {
  tag: 'BOT',
  remove: 'Remover Maestro',
  confirm: 'Remover o Maestro deste servidor? Você pode adicioná-lo de novo nas configurações.',
  add: 'Adicionar Maestro'
}
export const T20 = {
  watch: 'Ver vídeo',
  fullscreen: 'Tela cheia',
  showInPanel: 'Mostrar vídeo no painel'
}

export interface SlashSuggestion {
  command: string
  aliases: string[]
  usage: string
}

const COMMANDS: SlashSuggestion[] = [
  { command: '/play', aliases: ['/p', '/tocar'], usage: '/play <link ou nome>' },
  { command: '/skip', aliases: ['/s', '/pular'], usage: '/skip' },
  { command: '/fila', aliases: ['/q'], usage: '/fila' },
  { command: '/help', aliases: ['/ajuda', '/musica'], usage: '/help' }
]

/** Sugestões ao digitar "/" (some depois do primeiro espaço). */
export function slashSuggestions(input: string): SlashSuggestion[] {
  if (!input.startsWith('/') || /\s/.test(input)) return []
  const typed = input.toLowerCase()
  return COMMANDS.filter((c) => [c.command, ...c.aliases].some((name) => name.startsWith(typed)))
}

export function formatDuration(ms: number): string {
  const total = Math.floor(ms / 1000)
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = total % 60
  const pad = (n: number): string => String(n).padStart(2, '0')
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`
}

/** Só troca duas músicas diferentes, as duas pedidas por mim. */
export function canSwap(a: MusicItem, b: MusicItem, meId: string | null | undefined): boolean {
  return !!meId && a.id !== b.id && a.requested_by.id === meId && b.requested_by.id === meId
}

/** "**negrito**" das mensagens do Maestro. */
export function splitBold(text: string): { text: string; bold: boolean }[] {
  return text
    .split('**')
    .map((part, i) => ({ text: part, bold: i % 2 === 1 }))
    .filter((p) => p.text !== '')
}

// Volume da música quando alguém fala: 35%, desce em 150 ms, volta em 600 ms
// depois de 600 ms sem fala.
export const DUCK_GAIN = 0.35
const DUCK_ATTACK_MS = 150
const DUCK_RELEASE_MS = 600
const DUCK_HOLD_MS = 600

export function duckTarget(input: {
  speakingIds: string[]
  meId: string | null | undefined
  enabled: boolean
  lastOtherSpeechAt: number
  now: number
}): number {
  if (!input.enabled) return 1
  const othersSpeaking = input.speakingIds.some((id) => id !== input.meId && !isMaestroIdentity(id))
  if (othersSpeaking || input.now - input.lastOtherSpeechAt < DUCK_HOLD_MS) return DUCK_GAIN
  return 1
}

export function stepGain(current: number, target: number, dtMs: number): number {
  const range = 1 - DUCK_GAIN
  if (target < current) return Math.max(target, current - (range * dtMs) / DUCK_ATTACK_MS)
  if (target > current) return Math.min(target, current + (range * dtMs) / DUCK_RELEASE_MS)
  return current
}

/** Onde o vídeo deveria estar: o áudio da call chega com atraso, então o vídeo também. */
export function videoTargetSec(input: {
  startedAt: number
  nowMs: number
  serverOffsetMs: number
  audioLatencyMs: number
}): number {
  return (input.nowMs + input.serverOffsetMs - input.startedAt - input.audioLatencyMs) / 1000
}

export type VideoSyncAction =
  { kind: 'none' } | { kind: 'rate'; rate: number } | { kind: 'seek'; to: number }

export function videoSyncAction(currentSec: number, targetSec: number): VideoSyncAction {
  const drift = targetSec - currentSec
  if (Math.abs(drift) < 0.08) return { kind: 'none' }
  if (Math.abs(drift) < 1) return { kind: 'rate', rate: drift > 0 ? 1.05 : 0.95 }
  return { kind: 'seek', to: targetSec }
}

/** O cliente conta como espectador se o vídeo está no painel ou no palco. */
export function wantsVideo(hasVideo: boolean, stageVideo: boolean, panelVideo: boolean): boolean {
  return hasVideo && (stageVideo || panelVideo)
}
