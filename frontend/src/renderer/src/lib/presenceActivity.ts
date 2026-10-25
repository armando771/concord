// "Em atividade" (rich presence): o jogo que a pessoa está jogando agora. Não
// confundir com lib/activityState.ts (jogos web abertos numa chamada). Puro.

export interface PresenceActivity {
  name: string
  kind: 'game'
  /** Unix em ms de quando começou. */
  started_at: number
}

/** Valida o que veio do servidor; qualquer coisa fora do formato vira null. */
export function sanitizeActivity(raw: unknown): PresenceActivity | null {
  if (typeof raw !== 'object' || raw === null) return null
  const { name, kind, started_at } = raw as Record<string, unknown>
  if (typeof name !== 'string' || !name.trim() || kind !== 'game') return null
  if (typeof started_at !== 'number' || !Number.isFinite(started_at)) return null
  return { name: name.trim(), kind: 'game', started_at }
}

/** "há 5 min", "há 2 h", "há 1 d": desde quando a pessoa joga. */
export function activityElapsed(startedAt: number, now: number): string {
  const minutes = Math.max(0, Math.floor((now - startedAt) / 60_000))
  if (minutes < 1) return 'agora'
  if (minutes < 60) return `há ${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `há ${hours} h`
  return `há ${Math.floor(hours / 24)} d`
}

export type ActivityLineKind = 'game' | 'voice' | 'note' | 'status'

export interface ActivityLine {
  kind: ActivityLineKind
  text: string
}

/**
 * Linha embaixo do nome, na ordem do Discord: jogo, "Em voz", nota
 * personalizada e, por fim, o status.
 */
export function activityLine(user: {
  activity: PresenceActivity | null | undefined
  inVoice: boolean
  note: string | null | undefined
  statusLabel: string
}): ActivityLine {
  if (user.activity) return { kind: 'game', text: user.activity.name }
  if (user.inVoice) return { kind: 'voice', text: 'Em voz' }
  const note = user.note?.trim()
  if (note) return { kind: 'note', text: note }
  return { kind: 'status', text: user.statusLabel }
}

/** Amigos jogando agora, do que começou há menos tempo para o mais antigo. */
export function playingFriends<T extends { id: string }>(
  friends: readonly T[],
  byUser: Readonly<Record<string, PresenceActivity>>
): { friend: T; activity: PresenceActivity }[] {
  const list: { friend: T; activity: PresenceActivity }[] = []
  for (const friend of friends) {
    const activity = byUser[friend.id]
    if (activity) list.push({ friend, activity })
  }
  return list.sort((a, b) => b.activity.started_at - a.activity.started_at)
}
