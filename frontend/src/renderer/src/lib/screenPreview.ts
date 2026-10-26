import type { CallStateResponse } from '../api/calls'

// Prévia da transmissão no cartão de perfil. A tela é publicada sem simulcast
// (uma camada só, na qualidade escolhida), então assinar o vídeo para uma
// miniatura baixaria a transmissão inteira — e quem está fora da chamada nem
// está na sala do LiveKit. Por isso a prévia é uma foto JPEG pequena que quem
// transmite manda ao servidor só quando alguém está com o cartão aberto.
// Puro, sem store nem DOM.

/** Maior tamanho da foto (16:9, nítida no cartão de 268 px em tela 1,5x). */
export const PREVIEW_MAX_WIDTH = 384
export const PREVIEW_MAX_HEIGHT = 216
/** Qualidade do JPEG: ~15–30 KB por foto. */
export const PREVIEW_JPEG_QUALITY = 0.7
/** Com o cartão aberto, busca a foto de novo a cada tanto (o servidor pede outra se ficou velha). */
export const PREVIEW_POLL_MS = 10_000
/** Foto pedida e ainda não chegou: tenta de novo logo. */
export const PREVIEW_RETRY_MS = 1_500
/** Tentativas rápidas antes de voltar ao intervalo normal. */
export const PREVIEW_FAST_RETRIES = 4
/** Quem transmite não tira mais de uma foto nesse intervalo, peça quem pedir. */
export const PREVIEW_CAPTURE_EVERY_MS = 2_000

/** Tamanho da foto: cabe em 384×216 mantendo a proporção; nunca aumenta. */
export function previewSize(
  width: number,
  height: number
): { width: number; height: number } | null {
  if (!(width > 0) || !(height > 0)) return null
  const scale = Math.min(1, PREVIEW_MAX_WIDTH / width, PREVIEW_MAX_HEIGHT / height)
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale))
  }
}

/** Quando buscar a foto de novo: rápido enquanto ela não chega, depois no ritmo normal. */
export function previewPollDelay(hasImage: boolean, fastRetriesUsed: number): number {
  return !hasImage && fastRetriesUsed < PREVIEW_FAST_RETRIES ? PREVIEW_RETRY_MS : PREVIEW_POLL_MS
}

/** Base64 do JPEG para o <img>. */
export function previewDataUrl(base64: string): string {
  return `data:image/jpeg;base64,${base64}`
}

/** "data:image/jpeg;base64,XXXX" → "XXXX" (o servidor recebe só o base64). */
export function stripDataUrl(dataUrl: string): string | null {
  const prefix = 'data:image/jpeg;base64,'
  return dataUrl.startsWith(prefix) && dataUrl.length > prefix.length
    ? dataUrl.slice(prefix.length)
    : null
}

export interface MyCall {
  status: 'idle' | 'ringing' | 'outgoing' | 'active'
  callId: string | null
  type: 'dm' | 'channel' | null
  channelId: string | null
  screenSharers: string[]
  availableScreens: string[]
}

/**
 * Onde a pessoa está transmitindo e o que o botão faz:
 * - watch: estou na mesma chamada, só assistir;
 * - join: chamada num canal de voz do servidor aberto em que posso entrar.
 */
export type LiveTarget =
  | { kind: 'watch'; callId: string }
  | { kind: 'join'; callId: string; channelId: string; serverId: string | null }

/** Canal de voz (do servidor aberto) em que a pessoa está transmitindo. */
function sharingEntry(
  serverCalls: Record<string, CallStateResponse>,
  userId: string
): [string, CallStateResponse] | null {
  for (const [channelId, entry] of Object.entries(serverCalls)) {
    if (!entry.call || entry.call.status !== 'active') continue
    if (!(entry.screen_sharing ?? []).includes(userId)) continue
    if (!entry.participants.some((p) => p.user_id === userId)) continue
    return [channelId, entry]
  }
  return null
}

/** Está ao vivo, para o selo LIVE (na minha chamada ou num canal visível). */
export function isUserLive(
  userId: string,
  call: MyCall,
  serverCalls: Record<string, CallStateResponse>
): boolean {
  if (call.status === 'active' && call.screenSharers.includes(userId)) return true
  return sharingEntry(serverCalls, userId) !== null
}

/**
 * Se dá para assistir a transmissão da pessoa a partir do cartão. Sala
 * trancada (sem eu dentro) e canal sem permissão de entrar não mostram nada:
 * a prévia só aparece para quem poderia assistir.
 */
export function liveTarget(input: {
  userId: string
  meId: string | null | undefined
  call: MyCall
  serverCalls: Record<string, CallStateResponse>
  canConnect: (channelId: string) => boolean
}): LiveTarget | null {
  const { userId, meId, call, serverCalls } = input
  if (!userId || userId === meId) return null
  const inMyCall = call.status === 'active' && call.callId !== null

  if (inMyCall && (call.screenSharers.includes(userId) || call.availableScreens.includes(userId))) {
    return { kind: 'watch', callId: call.callId as string }
  }

  const found = sharingEntry(serverCalls, userId)
  if (!found) return null
  const [channelId, entry] = found
  const callId = entry.call?.id
  if (!callId) return null
  if (inMyCall && call.callId === callId) return { kind: 'watch', callId }
  if (entry.call?.locked || !input.canConnect(channelId)) return null
  return { kind: 'join', callId, channelId, serverId: entry.call?.server_id ?? null }
}

/** Entrar no canal dela me tira de outra chamada (canal diferente ou DM): pede confirmação. */
export function needsLeaveConfirm(call: MyCall, channelId: string): boolean {
  if (call.status === 'idle') return false
  return !(call.type === 'channel' && call.channelId === channelId)
}
