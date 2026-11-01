/**
 * Quem vê a animação de subida de nível do servidor, e quando:
 * - quem está com o app aberto NAQUELE servidor (janela à vista) vê na hora;
 * - quem estava em outro lugar vê uma vez, ao abrir o servidor;
 * - nunca toca duas vezes para o mesmo nível.
 * O último nível já celebrado fica guardado por servidor no localStorage
 * (é só conveniência de cada pessoa, nada no servidor).
 */
export interface CelebrationInput {
  level: number
  /** Nível anterior: vem no server:level:up; ao abrir o servidor não há. */
  previous?: number
  /** Último nível já celebrado neste servidor (undefined: nunca guardado). */
  seen: number | undefined
  /** Você está neste servidor com a janela à vista. */
  viewing: boolean
}

export interface CelebrationDecision {
  /** Toca agora, contando de `from` até o nível. */
  play: boolean
  from: number
  /** Novo "último celebrado" a guardar (undefined: não mexe). */
  remember?: number
}

export function decideServerCelebration(input: CelebrationInput): CelebrationDecision {
  const { level, previous, seen, viewing } = input
  const none = { play: false, from: level }
  if (seen !== undefined && level <= seen) return none
  const from = seen ?? previous
  // Primeira vez que este app vê o nível deste servidor, sem saber de onde
  // veio: só marca o ponto de partida (não festeja o nível que já existia).
  if (from === undefined) return { ...none, remember: level }
  // Fora do servidor: guarda o ponto de partida para festejar ao abrir.
  if (!viewing) return seen === undefined ? { ...none, remember: from } : none
  return { play: true, from, remember: level }
}

const STORAGE_KEY = 'salinha:serverlevel:celebrated'

type Store = Pick<Storage, 'getItem' | 'setItem'>

function readAll(storage: Store | undefined): Record<string, number> {
  try {
    const parsed: unknown = JSON.parse(storage?.getItem(STORAGE_KEY) ?? '{}')
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, number>) : {}
  } catch {
    return {}
  }
}

/** Último nível já celebrado no servidor (undefined se nunca guardado). */
export function readCelebrated(storage: Store | undefined, serverId: string): number | undefined {
  const value = readAll(storage)[serverId]
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

export function writeCelebrated(storage: Store | undefined, serverId: string, level: number): void {
  try {
    storage?.setItem(STORAGE_KEY, JSON.stringify({ ...readAll(storage), [serverId]: level }))
  } catch {
    // Sem espaço ou sem localStorage: no pior caso a animação toca de novo.
  }
}
