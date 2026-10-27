// Sons da transmissão (tela/live) na call em que estou: abriu, acabou, e
// alguém começou a assistir a live que eu tenho aberta. Puro: compara o estado
// anterior com o novo; quem liga isso aos stores é o screenSoundsStart.

import type { SoundName } from './sounds'

export type ScreenSound = Extract<SoundName, 'liveStart' | 'liveEnd' | 'liveJoin'>

/** O pedaço do estado da call que decide os sons de transmissão. */
export interface ScreenSoundView {
  callId: string | null
  status: string
  deafened: boolean
  /** Quem está na call (para não tratar "saiu da call" como "encerrou a live"). */
  participantIds: string[]
  /** Quem transmite (eu incluso, quando sou eu). */
  sharers: string[]
  /** Por transmissão (id de quem transmite): quem está assistindo. */
  watchers: Record<string, { id: string }[]>
}

/** Intervalo mínimo entre dois sons iguais: pessoas entrando juntas viram um toque só. */
export const SCREEN_SOUND_GAP_MS = 1000

const isActive = (v: ScreenSoundView): boolean => v.callId !== null && v.status === 'active'

/** A mesma call, ativa antes e depois, e eu ouvindo (não ensurdecido). */
function listening(prev: ScreenSoundView, next: ScreenSoundView, meId: string | undefined): boolean {
  if (!meId || next.deafened) return false
  return isActive(prev) && isActive(next) && prev.callId === next.callId
}

const watching = (v: ScreenSoundView, sharerId: string, userId: string): boolean =>
  (v.watchers[sharerId] ?? []).some((w) => w.id === userId)

/** Estou com essa live aberta: eu transmito, ou assisto a ela. */
function liveOpenForMe(v: ScreenSoundView, sharerId: string, meId: string): boolean {
  return sharerId === meId ? v.sharers.includes(meId) : watching(v, sharerId, meId)
}

/** Alguém além de mim começou a assistir a essa transmissão. */
function newViewerOn(
  prev: ScreenSoundView,
  next: ScreenSoundView,
  sharerId: string,
  meId: string
): boolean {
  if (!liveOpenForMe(prev, sharerId, meId) || !liveOpenForMe(next, sharerId, meId)) return false
  return (next.watchers[sharerId] ?? []).some((w) => w.id !== meId && !watching(prev, sharerId, w.id))
}

/**
 * Os sons que a mudança de `prev` para `next` pede, sem repetir nome:
 * - liveStart: outra pessoa abriu transmissão;
 * - liveEnd: a transmissão de outra pessoa acabou (sair da call é outro som);
 * - liveJoin: alguém começou a assistir a uma live que eu tenho aberta.
 * Entrar na call já com live rolando, call trocada ou ensurdecido: nada.
 */
export function screenSoundsBetween(
  prev: ScreenSoundView,
  next: ScreenSoundView,
  meId: string | undefined
): ScreenSound[] {
  if (!meId || !listening(prev, next, meId)) return []
  const sounds: ScreenSound[] = []
  const others = (ids: string[]): string[] => ids.filter((id) => id !== meId)
  if (others(next.sharers).some((id) => !prev.sharers.includes(id))) sounds.push('liveStart')
  const stopped = others(prev.sharers).filter(
    (id) => !next.sharers.includes(id) && next.participantIds.includes(id)
  )
  if (stopped.length > 0) sounds.push('liveEnd')
  if (Object.keys(next.watchers).some((id) => newViewerOn(prev, next, id, meId))) {
    sounds.push('liveJoin')
  }
  return sounds
}

export interface ScreenSoundGateDeps {
  play: (sound: ScreenSound) => void
  now: () => number
}

export interface ScreenSoundGate {
  /** O estado da call mudou (chamado pela assinatura do store). */
  stateChanged: (prev: ScreenSoundView, next: ScreenSoundView, meId: string | undefined) => void
  /** O despachante do WS acabou de tratar um evento: libera o que a mudança dele pediu. */
  wsEventHandled: () => void
  /** Fim do turno: mudança que não veio de evento do WS (carga inicial, reconexão) não toca. */
  endOfTick: () => void
}

/**
 * Só toca o que veio de um evento do WS: o store é atualizado e o ouvinte do
 * WS roda logo em seguida, no mesmo turno. Carga do estado ao entrar na call ou
 * ao reconectar muda o store fora disso e fica de fora. Cada som toca no máximo
 * uma vez por SCREEN_SOUND_GAP_MS.
 */
export function createScreenSoundGate(deps: ScreenSoundGateDeps): ScreenSoundGate {
  let pending = new Set<ScreenSound>()
  const lastPlayed = new Map<ScreenSound, number>()

  const playThrottled = (sound: ScreenSound): void => {
    const at = deps.now()
    const last = lastPlayed.get(sound)
    if (last !== undefined && at - last < SCREEN_SOUND_GAP_MS) return
    lastPlayed.set(sound, at)
    deps.play(sound)
  }

  return {
    stateChanged: (prev, next, meId) => {
      for (const sound of screenSoundsBetween(prev, next, meId)) pending.add(sound)
    },
    wsEventHandled: () => {
      const sounds = pending
      pending = new Set()
      sounds.forEach(playThrottled)
    },
    endOfTick: () => {
      pending = new Set()
    }
  }
}
