// Estado do overlay de jogo, montado no renderer principal a partir da call e
// mandado ao main por IPC. Auto-contido (sem store nem livekit): o main também
// lê estes tipos.

import { normalizeOverlayLayout, type OverlayLayout } from './overlayLayout'
import { isAnimatedMedia, profileMediaSrc } from '../../profile/lib/profileMedia'
import { normalizeOverlayShortcut, OVERLAY_SHORTCUT_DEFAULT } from './overlayShortcut'
import type { OverlayTheme } from './overlayTheme'
import { myLiveWatchers, type MyLiveInput } from './overlayWatchers'

export interface OverlayMember {
  id: string
  name: string
  initial: string
  /** URL absoluta do avatar, parada se for GIF; null = mostra a inicial. */
  avatarUrl: string | null
  /**
   * O GIF em movimento (só se o avatar anima), usado por quem fala: GIF rodando o
   * tempo todo faz o DWM recompor a janela sobre o jogo e custa FPS.
   */
  avatarAnimatedUrl: string | null
  self: boolean
  muted: boolean
  deafened: boolean
  speaking: boolean
  /** Está assistindo a minha live (ganha um olho ao lado do nome). */
  watchingMe: boolean
}

export interface OverlaySnapshot {
  enabled: boolean
  inCall: boolean
  members: OverlayMember[]
  /** Quantos ficaram de fora ("+N"); 0 = todos aparecem. */
  more: number
  /** Espectadores da minha live (olho + número); null = sem live ou opção desligada. */
  viewers: number | null
  /** Opacidade das pílulas em repouso, em % (OVERLAY_OPACITY_MIN–MAX). */
  opacity: number
  /** Posição e tamanho da lista (atalho para editar no jogo). */
  layout: OverlayLayout
  /** Atalho global do modo de edição (accelerator do Electron). */
  shortcut: string
  /** Cores do tema em vigor (só o overlay nativo do Windows usa). */
  theme?: Partial<OverlayTheme> | null
}

export interface OverlayPerson {
  id: string
  username: string
  display_name: string
  avatar_url?: string | null
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
  shortcut: string
  /** Minha live e quem a assiste (vem do callStore); sem isso, nada de olho. */
  liveWatchers?: Omit<MyLiveInput, 'meId'>
  /** API_BASE_URL: dá a origem aos avatares (a janela do overlay não é a da API). */
  mediaBase: string
  theme?: Partial<OverlayTheme> | null
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
 * Versão das preferências salvas do overlay. v0: opacidade da lista inteira
 * (20–100%, padrão 70%). v1: opacidade de cada pílula em repouso (10–60%).
 * v2: atalho do modo de edição configurável.
 */
export const OVERLAY_PREFS_VERSION = 2

function savedObject(persisted: unknown): Record<string, unknown> {
  return persisted && typeof persisted === 'object' ? (persisted as Record<string, unknown>) : {}
}

/**
 * Preferências salvas → valores válidos, mantendo o resto. Roda a cada carga
 * (merge do persist): sem isso, um valor estragado da versão atual entraria
 * direto (o migrate só roda quando a versão muda).
 */
export function normalizeOverlayPrefs(persisted: unknown): Record<string, unknown> {
  const saved = savedObject(persisted)
  return {
    ...saved,
    opacity: clampOverlayOpacity(saved.opacity as number),
    layout: normalizeOverlayLayout(saved.layout),
    shortcut: normalizeOverlayShortcut(saved.shortcut),
    // Só false explícito desliga: valor estragado volta ao padrão (ligado).
    showWatchers: saved.showWatchers !== false
  }
}

/**
 * Preferências salvas numa versão antiga → versão atual. A opacidade de antes
 * da v1 mudou de sentido (não é mais a da lista inteira): volta ao padrão.
 * Antes da v2 não havia atalho: fica o padrão.
 */
export function migrateOverlayPrefs(persisted: unknown, version: number): Record<string, unknown> {
  const saved = { ...savedObject(persisted) }
  if (version < 1) saved.opacity = OVERLAY_OPACITY_DEFAULT
  if (version < 2) saved.shortcut = OVERLAY_SHORTCUT_DEFAULT
  return normalizeOverlayPrefs(saved)
}

function nameOf(person: OverlayPerson): string {
  return person.display_name.trim() || person.username.trim() || 'Usuário'
}

/**
 * Imagem do avatar na pílula: quem fala anima (GIF), os outros ficam no quadro
 * parado. null = mostra a inicial (sem avatar, ou o endereço já falhou).
 */
export function overlayAvatarSrc(
  member: Pick<OverlayMember, 'speaking' | 'avatarUrl' | 'avatarAnimatedUrl'>,
  failedUrl: string | null
): string | null {
  const url = member.speaking ? (member.avatarAnimatedUrl ?? member.avatarUrl) : member.avatarUrl
  return url === failedUrl ? null : url
}

/** Mesmo conteúdo? O bridge só manda ao main (e ao jogo) o que mudou de verdade. */
export function sameOverlaySnapshot(a: OverlaySnapshot | null, b: OverlaySnapshot): boolean {
  return a !== null && JSON.stringify(a) === JSON.stringify(b)
}

/** Lista da call: eu no topo, depois os outros; `watching` = quem assiste a minha live. */
function overlayMembers(input: OverlayInput, me: OverlayPerson, watching: string[]): OverlayMember[] {
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
      avatarUrl: profileMediaSrc(person.avatar_url, input.mediaBase, { animate: false }),
      avatarAnimatedUrl: isAnimatedMedia(person.avatar_url)
        ? profileMediaSrc(person.avatar_url, input.mediaBase)
        : null,
      self,
      muted,
      deafened,
      speaking: input.speakingIds.includes(person.id) && !muted,
      watchingMe: watching.includes(person.id)
    }
  }
  return [
    member(me, true, input.muted, input.deafened),
    ...input.participants
      .filter((p) => p.id !== me.id)
      .map((p) => {
        const voice = input.voiceStates[p.id]
        return member(p, false, voice?.muted ?? false, voice?.deafened ?? false)
      })
  ]
}

export function buildOverlaySnapshot(
  input: OverlayInput,
  maxRows = OVERLAY_MAX_ROWS
): OverlaySnapshot {
  const { me } = input
  const base = {
    enabled: input.enabled,
    opacity: clampOverlayOpacity(input.opacity),
    layout: normalizeOverlayLayout(input.layout),
    shortcut: normalizeOverlayShortcut(input.shortcut),
    theme: input.theme ?? null
  }
  if (input.status !== 'active' || me === null) {
    return { ...base, inCall: false, members: [], more: 0, viewers: null }
  }

  const live = myLiveWatchers({ live: false, show: false, watchers: [], ...input.liveWatchers, meId: me.id })
  const all = overlayMembers(input, me, live.ids)
  const shown = all.length <= maxRows ? all : all.slice(0, maxRows - 1)
  return {
    ...base,
    inCall: true,
    members: shown,
    more: all.length - shown.length,
    viewers: live.viewers
  }
}
