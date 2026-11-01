// Som de entrada: quando alguém entra na call de canal em que estou, toca o
// som que a pessoa escolheu no perfil; sem som (ou se não der para tocar), o
// som padrão de "alguém entrou".

/** Quem entrou, como vem no call:joined (o UserInfo do backend). */
export interface JoinedUser {
  id: string
  entrance_sound_url?: string | null
}

/** O pedaço do estado da call que decide se o som é comigo. */
export interface CallView {
  callId: string | null
  type: string | null
  status: string
}

export type JoinSound = { kind: 'custom'; src: string; volume: number } | { kind: 'default' }

export interface JoinSoundOptions {
  deafened: boolean
  /** Eu silenciei essa pessoa (volume por usuário). */
  locallyMuted: boolean
  /** Volume da mesa de áudio (0 a 1): o som de entrada é um clipe como os dela. */
  volume: number
  /** API_BASE_URL: "http://host/api" no desktop, "/api" no navegador. */
  apiBase: string
}

// Só o caminho que o backend grava: o app nunca carrega áudio de outro lugar.
const ENTRANCE_SOUND_PATH =
  /^\/api\/entrance-sounds\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

/** Endereço do <audio> para a URL salva, ou null se ela não é um som de entrada. */
export function entranceSoundSrc(url: string | null | undefined, apiBase: string): string | null {
  if (!url || !ENTRANCE_SOUND_PATH.test(url)) return null
  const origin = /^https?:\/\//.test(apiBase) ? new URL(apiBase).origin : ''
  return `${origin}${url}`
}

/**
 * A pessoa que entrou na minha call de canal ativa (não eu), ou null quando o
 * evento não pede som. DM tem o próprio som ("join") no callStore.
 */
export function joinedOtherUser(
  event: { type: string; payload: unknown },
  call: CallView,
  meId: string | undefined
): JoinedUser | null {
  if (event.type !== 'call:joined' || call.type !== 'channel' || call.status !== 'active')
    return null
  const p = event.payload as { call_id?: string; user?: JoinedUser } | null
  const user = p?.user
  if (p?.call_id !== call.callId || !user?.id || !meId || user.id === meId) return null
  return user
}

/** Som personalizado só quando dá para ouvir; senão, o padrão (que já tocava antes). */
export function chooseJoinSound(user: JoinedUser, opts: JoinSoundOptions): JoinSound {
  const src = entranceSoundSrc(user.entrance_sound_url, opts.apiBase)
  if (!src || opts.deafened || opts.locallyMuted || opts.volume <= 0) return { kind: 'default' }
  return { kind: 'custom', src, volume: Math.min(1, opts.volume) }
}
