// "Fulano está digitando…": quem está digitando em cada sala (canal ou DM),
// a frase mostrada embaixo do campo e o intervalo de envio do aviso.

/** Sem novo evento, a pessoa some 5 s depois do último. */
export const TYPING_TTL_MS = 5000
/** Enquanto digito, mando o aviso no máximo a cada 3 s. */
export const TYPING_SEND_INTERVAL_MS = 3000

export interface Typer {
  userId: string
  name: string
  expiresAt: number
}

export type TypingByRoom = Record<string, Typer[]>

/** Entra (ou renova) quem digita, mantendo a ordem de chegada. */
export function addTyper(
  state: TypingByRoom,
  room: string,
  userId: string,
  name: string,
  now: number
): TypingByRoom {
  const typer: Typer = { userId, name, expiresAt: now + TYPING_TTL_MS }
  const current = state[room] ?? []
  const index = current.findIndex((t) => t.userId === userId)
  const next = index === -1 ? [...current, typer] : current.map((t, i) => (i === index ? typer : t))
  return { ...state, [room]: next }
}

/** Tira quem parou ou mandou mensagem. Sem mudança, devolve o mesmo estado. */
export function removeTyper(state: TypingByRoom, room: string, userId: string): TypingByRoom {
  const current = state[room]
  if (!current?.some((t) => t.userId === userId)) return state
  const rest = current.filter((t) => t.userId !== userId)
  const next = { ...state }
  if (rest.length > 0) next[room] = rest
  else delete next[room]
  return next
}

/** Tira quem venceu. Sem mudança, devolve o mesmo estado. */
export function pruneTypers(state: TypingByRoom, now: number): TypingByRoom {
  let changed = false
  const next: TypingByRoom = {}
  for (const [room, typers] of Object.entries(state)) {
    const alive = typers.filter((t) => t.expiresAt > now)
    if (alive.length !== typers.length) changed = true
    if (alive.length > 0) next[room] = alive
  }
  return changed ? next : state
}

export function nextTypingExpiry(state: TypingByRoom): number | null {
  let next: number | null = null
  for (const typers of Object.values(state)) {
    for (const t of typers) {
      if (next === null || t.expiresAt < next) next = t.expiresAt
    }
  }
  return next
}

/**
 * Quem aparece digitando na sala: nunca eu, nunca quem já venceu. Sem now
 * (na tela), confia no store, que já tira quem venceu.
 */
export function typersIn(
  state: TypingByRoom,
  room: string,
  meId: string | null | undefined,
  now = -Infinity
): Typer[] {
  return (state[room] ?? []).filter((t) => t.userId !== meId && t.expiresAt > now)
}

export interface TypingSegment {
  text: string
  bold?: boolean
}

/** A frase em pedaços (nomes em negrito). Vazia quando ninguém digita. */
export function typingSegments(names: string[]): TypingSegment[] {
  if (names.length === 0) return []
  if (names.length >= 4) return [{ text: 'Várias pessoas estão digitando…' }]
  if (names.length === 1) return [{ text: names[0], bold: true }, { text: ' está digitando…' }]
  const segments: TypingSegment[] = []
  names.forEach((name, i) => {
    if (i > 0) segments.push({ text: i === names.length - 1 ? ' e ' : ', ' })
    segments.push({ text: name, bold: true })
  })
  segments.push({ text: ' estão digitando…' })
  return segments
}

// ===== Envio do aviso =====

/** lastSentAt null: não avisei (ou já mandei o stop). */
export interface TypingSender {
  lastSentAt: number | null
}

export type TypingSignal = 'typing' | 'stop' | null

export const IDLE_TYPING: TypingSender = { lastSentAt: null }

/**
 * O texto do campo mudou (só mudança de texto, mexer o cursor não conta).
 * Primeira tecla avisa na hora; depois, no máximo a cada 3 s. Campo vazio
 * depois de avisar manda stop.
 */
export function typingOnInput(
  state: TypingSender,
  text: string,
  now: number
): { state: TypingSender; signal: TypingSignal } {
  if (text.trim() === '') return typingOnDone(state)
  if (state.lastSentAt !== null && now - state.lastSentAt < TYPING_SEND_INTERVAL_MS) {
    return { state, signal: null }
  }
  return { state: { lastSentAt: now }, signal: 'typing' }
}

/** Mensagem enviada, campo limpo ou saí da sala: stop se eu tinha avisado. */
export function typingOnDone(state: TypingSender): {
  state: TypingSender
  signal: TypingSignal
} {
  return { state: IDLE_TYPING, signal: state.lastSentAt === null ? null : 'stop' }
}
