import { useMemo } from 'react'
import type { Mentionable } from '../../chat/components/ChatPane'
import { useServerStore } from '../store/serverStore'

/**
 * Quem pode ser marcado com @ no chat de um canal do servidor aberto. Estável
 * entre renders: o ChatPane monta os nomes das menções a partir dele.
 */
export function useServerMentionable(): Mentionable[] {
  const members = useServerStore((s) => s.currentMembers)
  return useMemo(
    () =>
      members
        .filter((m) => m.username)
        .map((m) => ({
          username: m.username as string,
          display_name: m.display_name || (m.username as string),
          nickname: m.nickname
        })),
    [members]
  )
}
