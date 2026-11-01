import { mentionLabels } from '../../chat/lib/mentions'
import type { SpokenNames } from './ttsText'

/** De onde saem os nomes que a voz lê (estado dos stores, injetado). */
export interface TTSNameSources {
  /** Quem está na call. */
  participants: { id: string; username: string; display_name: string }[]
  /** Apelidos por servidor (serverId → userId → apelido). */
  nicknames: Record<string, Record<string, string>>
  /** Servidor aberto agora e os membros dele (só ele tem a lista carregada). */
  currentServerId: string | null | undefined
  currentMembers: { user_id: string; username?: string; display_name?: string }[]
}

/** Nomes de quem está na call e dos membros do servidor da call, com apelido. */
export function ttsNames(
  authorId: string,
  serverId: string | null,
  src: TTSNameSources
): SpokenNames {
  const nicknames = (serverId && src.nicknames[serverId]) || {}
  const members = serverId && src.currentServerId === serverId ? src.currentMembers : []
  const people = [
    ...src.participants.map((p) => ({ ...p, nickname: nicknames[p.id] })),
    ...members.map((m) => ({
      username: m.username ?? '',
      display_name: m.display_name,
      nickname: nicknames[m.user_id]
    }))
  ]
  return { labels: mentionLabels(people), authorNickname: nicknames[authorId] }
}
