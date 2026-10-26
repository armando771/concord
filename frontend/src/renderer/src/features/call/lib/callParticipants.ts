import { isMaestroIdentity } from '../../music/lib/music'
import type { NameStyle } from '../../profile/lib/nameStyle'

// Quem aparece no palco da chamada. A lista do backend pode perder alguém que
// continua na sala de mídia (ex.: o WS de chat caiu além da tolerância e o
// backend o tirou da chamada) — o LiveKit é quem sabe quem está de fato lá.

export interface CallPerson {
  id: string
  username: string
  display_name: string
  avatar_url?: string | null
  name_style?: NameStyle | null
  is_bot?: boolean
}

export const UNKNOWN_NAME = 'Usuário'

/**
 * Une a lista do backend com quem está na sala de mídia (userId -> nome do
 * token). Ninguém da sala fica de fora e o nome vem da melhor fonte: backend,
 * LiveKit, `resolveName` (ex.: membros do servidor) e só então "Usuário".
 */
export function mergeCallPeople(
  participants: CallPerson[],
  mediaPeers: Record<string, string>,
  meId: string | null,
  resolveName?: (userId: string) => string | undefined
): CallPerson[] {
  const nameFor = (id: string): string => mediaPeers[id] || resolveName?.(id) || UNKNOWN_NAME

  const merged = participants.map((p) =>
    p.display_name && p.display_name !== UNKNOWN_NAME ? p : { ...p, display_name: nameFor(p.id) }
  )
  const known = new Set(merged.map((p) => p.id))
  for (const id of Object.keys(mediaPeers)) {
    if (id === meId || known.has(id)) continue
    merged.push({
      id,
      username: '',
      display_name: nameFor(id),
      ...(isMaestroIdentity(id) ? { is_bot: true } : {})
    })
  }
  return merged
}
