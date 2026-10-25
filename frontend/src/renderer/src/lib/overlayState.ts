// Estado do overlay de jogo, montado no renderer principal a partir da call e
// mandado ao main por IPC. Auto-contido (sem store nem livekit): o main também
// lê estes tipos.

export interface OverlayMember {
  id: string
  name: string
  initial: string
  self: boolean
  muted: boolean
  deafened: boolean
  speaking: boolean
}

export interface OverlaySnapshot {
  enabled: boolean
  inCall: boolean
  members: OverlayMember[]
  /** Quantos ficaram de fora ("+N"); 0 = todos aparecem. */
  more: number
  /** Opacidade da lista, em % (OVERLAY_OPACITY_MIN–100). */
  opacity: number
}

export interface OverlayPerson {
  id: string
  username: string
  display_name: string
}

export interface OverlayInput {
  enabled: boolean
  status: 'idle' | 'ringing' | 'outgoing' | 'active'
  me: OverlayPerson | null
  /** Os outros (o callStore não inclui o próprio usuário). */
  participants: OverlayPerson[]
  voiceStates: Record<string, { muted: boolean; deafened: boolean }>
  speakingIds: string[]
  muted: boolean
  deafened: boolean
  /** "Opacidade do overlay" (Configurações → App), em %. */
  opacity: number
}

/** Pílulas no máximo (contando a do "+N"). */
export const OVERLAY_MAX_ROWS = 8

/** "Opacidade do overlay": 20% a 100% em passos de 5%, padrão 70%. */
export const OVERLAY_OPACITY_MIN = 20
export const OVERLAY_OPACITY_MAX = 100
export const OVERLAY_OPACITY_STEP = 5
export const OVERLAY_OPACITY_DEFAULT = 70

/** Encaixa no intervalo e no passo; valor estragado volta ao padrão. */
export function clampOverlayOpacity(value: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return OVERLAY_OPACITY_DEFAULT
  const stepped = Math.round(value / OVERLAY_OPACITY_STEP) * OVERLAY_OPACITY_STEP
  return Math.min(OVERLAY_OPACITY_MAX, Math.max(OVERLAY_OPACITY_MIN, stepped))
}

function nameOf(person: OverlayPerson): string {
  return person.display_name.trim() || person.username.trim() || 'Usuário'
}

export function buildOverlaySnapshot(
  input: OverlayInput,
  maxRows = OVERLAY_MAX_ROWS
): OverlaySnapshot {
  const { me } = input
  const opacity = clampOverlayOpacity(input.opacity)
  if (input.status !== 'active' || me === null) {
    return { enabled: input.enabled, inCall: false, members: [], more: 0, opacity }
  }

  const member = (
    person: OverlayPerson,
    self: boolean,
    muted: boolean,
    deafened: boolean
  ): OverlayMember => {
    const name = nameOf(person)
    return {
      id: person.id,
      name,
      initial: name.charAt(0).toUpperCase(),
      self,
      muted,
      deafened,
      speaking: input.speakingIds.includes(person.id) && !muted
    }
  }

  const all: OverlayMember[] = [
    member(me, true, input.muted, input.deafened),
    ...input.participants
      .filter((p) => p.id !== me.id)
      .map((p) => {
        const voice = input.voiceStates[p.id]
        return member(p, false, voice?.muted ?? false, voice?.deafened ?? false)
      })
  ]

  if (all.length <= maxRows) {
    return { enabled: input.enabled, inCall: true, members: all, more: 0, opacity }
  }
  const shown = all.slice(0, maxRows - 1)
  return {
    enabled: input.enabled,
    inCall: true,
    members: shown,
    more: all.length - shown.length,
    opacity
  }
}
