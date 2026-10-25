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
}

/** Pílulas no máximo (contando a do "+N"). */
export const OVERLAY_MAX_ROWS = 8

function nameOf(person: OverlayPerson): string {
  return person.display_name.trim() || person.username.trim() || 'Usuário'
}

export function buildOverlaySnapshot(
  input: OverlayInput,
  maxRows = OVERLAY_MAX_ROWS
): OverlaySnapshot {
  const { me } = input
  if (input.status !== 'active' || me === null) {
    return { enabled: input.enabled, inCall: false, members: [], more: 0 }
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
    return { enabled: input.enabled, inCall: true, members: all, more: 0 }
  }
  const shown = all.slice(0, maxRows - 1)
  return { enabled: input.enabled, inCall: true, members: shown, more: all.length - shown.length }
}
