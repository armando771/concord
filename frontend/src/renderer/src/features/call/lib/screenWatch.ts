// Regras de "assistindo transmissão": quais telas remotas estou vendo, qual
// fica em destaque e qual vai para a miniatura. Puro, sem store nem LiveKit.

/** Remove quem não está mais em `available`; devolve o MESMO array se nada saiu. */
export function pruneWatched(watched: string[], available: string[]): string[] {
  const next = watched.filter((id) => available.includes(id))
  return next.length === watched.length ? watched : next
}

/** Adiciona no fim (sem duplicar; se já existe, move para o fim). */
export function addWatched(watched: string[], userId: string): string[] {
  return [...watched.filter((id) => id !== userId), userId]
}

/**
 * Sem foco continua sem foco (nada abre sozinho); foco ainda válido (minha
 * tela ou uma assistida) fica; senão cai na última assistida ou na minha tela.
 */
export function resolveFocus(
  current: string | null,
  watched: string[],
  localSharerId: string | null
): string | null {
  if (current === null) return null
  if (current === localSharerId || watched.includes(current)) return current
  return watched[watched.length - 1] ?? localSharerId ?? null
}

export interface ScreenEntry {
  userId: string
  stream: MediaStream | null
  local: boolean
  watching: boolean
}

/** Minha tela primeiro; as dos outros só levam o stream se estou assistindo. */
export function buildScreenEntries(input: {
  meId: string
  localScreenStream: MediaStream | null
  availableScreens: string[]
  watchedScreenIds: string[]
  screenStreams: Record<string, MediaStream>
}): ScreenEntry[] {
  const entries: ScreenEntry[] = []
  if (input.localScreenStream) {
    entries.push({
      userId: input.meId,
      stream: input.localScreenStream,
      local: true,
      watching: true
    })
  }
  for (const userId of input.availableScreens) {
    if (userId === input.meId) continue
    const watching = input.watchedScreenIds.includes(userId)
    entries.push({
      userId,
      stream: watching ? (input.screenStreams[userId] ?? null) : null,
      local: false,
      watching
    })
  }
  return entries
}

/** Tela da miniatura: a em destaque, se assistida e com stream; senão a última assistida com stream. */
export function miniPlayerTarget(
  watched: string[],
  focused: string | null,
  screenStreams: Record<string, MediaStream>
): string | null {
  if (focused !== null && watched.includes(focused) && screenStreams[focused]) return focused
  for (let i = watched.length - 1; i >= 0; i--) {
    if (screenStreams[watched[i]]) return watched[i]
  }
  return null
}

/**
 * Fora da tela da call só a transmissão da miniatura continua assistida (as
 * outras voltam a pausadas: sem baixar, sem som). Sem vídeo ainda, fica a em
 * destaque ou a última assistida. Devolve o MESMO array se nada muda.
 */
export function miniPlayerOnly(
  watched: string[],
  focused: string | null,
  screenStreams: Record<string, MediaStream>
): string[] {
  if (watched.length <= 1) return watched
  const target =
    miniPlayerTarget(watched, focused, screenStreams) ??
    (focused !== null && watched.includes(focused) ? focused : watched[watched.length - 1])
  return [target]
}
