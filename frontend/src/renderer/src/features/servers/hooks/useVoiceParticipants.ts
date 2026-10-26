import type { CallParticipant, CallStateResponse } from '../../call/api/calls'
import { sortVoiceMembers } from '../../call/lib/voiceOrder'
import { useLevelStore } from '../../levels/store/levelStore'
import { serverDisplayName } from '../lib/serverNames'
import { useServerNicknames } from './useServerNames'

/**
 * Quem está no canal de voz, na ordem da barra de canais. O backend manda em
 * ordem de entrada; aqui vale nível (ver voiceOrder).
 */
export function useVoiceParticipants(
  entry: CallStateResponse | undefined,
  serverId: string | undefined
): CallParticipant[] {
  const nicknames = useServerNicknames(serverId)
  const levels = useLevelStore((s) => s.levels)
  return sortVoiceMembers(entry?.participants ?? [], (p) => ({
    id: p.user_id,
    name: serverDisplayName({ nickname: nicknames?.[p.user_id] }, p),
    level: levels[p.user_id],
    joinedAt: p.joined_at
  }))
}
