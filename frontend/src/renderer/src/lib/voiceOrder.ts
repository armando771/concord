/**
 * Ordem de quem está num canal de voz (lista da barra lateral e palco da
 * chamada): nível mais alto em cima; empate por quem entrou primeiro, depois
 * pelo nome e, por fim, pelo id — a mesma lista sempre sai na mesma ordem,
 * não importa como chegou (polling, eventos do WS).
 */
export interface VoiceMemberKey {
  id: string
  name: string
  /** Nível do levelStore; ainda não carregado conta como 0. */
  level?: number
  /** `joined_at` do backend (ISO), quando disponível. */
  joinedAt?: string
}

const joinedMs = (value?: string): number | null => {
  if (!value) return null
  const ms = Date.parse(value)
  return Number.isNaN(ms) ? null : ms
}

export function compareVoiceMembers(a: VoiceMemberKey, b: VoiceMemberKey): number {
  const byLevel = (b.level ?? 0) - (a.level ?? 0)
  if (byLevel !== 0) return byLevel

  const aJoined = joinedMs(a.joinedAt)
  const bJoined = joinedMs(b.joinedAt)
  if (aJoined !== null && bJoined !== null && aJoined !== bJoined) return aJoined - bJoined

  const byName = a.name.localeCompare(b.name, 'pt-BR')
  if (byName !== 0) return byName

  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0
}

/** Cópia ordenada de `items`; `key` diz nível, nome e entrada de cada um. */
export function sortVoiceMembers<T>(items: readonly T[], key: (item: T) => VoiceMemberKey): T[] {
  return items
    .map((item) => ({ item, k: key(item) }))
    .sort((x, y) => compareVoiceMembers(x.k, y.k))
    .map(({ item }) => item)
}
