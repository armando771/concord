// Estado do overlay de jogo, montado no renderer principal a partir da call e
// mandado ao main por IPC. Auto-contido (sem store nem livekit): o main também
// lê estes tipos.

import { normalizeOverlayLayout, type OverlayLayout } from './overlayLayout'

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
  /** Opacidade das pílulas em repouso, em % (OVERLAY_OPACITY_MIN–MAX). */
  opacity: number
  /** Posição e tamanho da lista (Shift+Tab para editar no jogo). */
  layout: OverlayLayout
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
  layout: OverlayLayout
}

/** Pílulas no máximo (contando a do "+N"). */
export const OVERLAY_MAX_ROWS = 8

/**
 * "Opacidade do overlay" = opacidade de cada pílula em repouso: 10% a 60% em
 * passos de 5%, padrão 30%. Quem fala ganha +40, até 85% (nunca 100%).
 */
export const OVERLAY_OPACITY_MIN = 10
export const OVERLAY_OPACITY_MAX = 60
export const OVERLAY_OPACITY_STEP = 5
export const OVERLAY_OPACITY_DEFAULT = 30
export const OVERLAY_SPEAKING_BOOST = 40
export const OVERLAY_SPEAKING_MAX = 85

/** Encaixa no intervalo e no passo; valor estragado volta ao padrão. */
export function clampOverlayOpacity(value: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return OVERLAY_OPACITY_DEFAULT
  const stepped = Math.round(value / OVERLAY_OPACITY_STEP) * OVERLAY_OPACITY_STEP
  return Math.min(OVERLAY_OPACITY_MAX, Math.max(OVERLAY_OPACITY_MIN, stepped))
}

/** Opacidade (em %) de uma pílula: repouso, ou mais forte para quem está falando. */
export function overlayRowOpacity(resting: number, speaking: boolean): number {
  const base = clampOverlayOpacity(resting)
  return speaking ? Math.min(base + OVERLAY_SPEAKING_BOOST, OVERLAY_SPEAKING_MAX) : base
}

/**
 * Preferências salvas antes da opacidade em repouso (20–100%, padrão 70%):
 * encaixa na faixa nova e mantém o resto.
 */
export function migrateOverlayPrefs(persisted: unknown): Record<string, unknown> {
  const saved =
    persisted && typeof persisted === 'object' ? (persisted as Record<string, unknown>) : {}
  return { ...saved, opacity: clampOverlayOpacity(saved.opacity as number) }
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
  const layout = normalizeOverlayLayout(input.layout)
  if (input.status !== 'active' || me === null) {
    return { enabled: input.enabled, inCall: false, members: [], more: 0, opacity, layout }
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
    return { enabled: input.enabled, inCall: true, members: all, more: 0, opacity, layout }
  }
  const shown = all.slice(0, maxRows - 1)
  return {
    enabled: input.enabled,
    inCall: true,
    members: shown,
    more: all.length - shown.length,
    opacity,
    layout
  }
}
