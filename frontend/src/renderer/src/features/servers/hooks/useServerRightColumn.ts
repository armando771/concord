import { useSearchStore } from '../../chat/store/searchStore'
import { useVoiceChatPanelStore } from '../../chat/store/voiceChatPanelStore'
import { VOICE_CHAT_WIDE_QUERY } from '../../chat/components/VoiceChatPanel'
import { useMediaQuery } from '../../../shared/hooks/useMediaQuery'
import { rightColumnFor, type RightColumn } from '../lib/serverLayout'

/**
 * O que ocupa a coluna da direita da tela do servidor e se o chat da call
 * está aberto como sobreposição (tela estreita).
 */
export function useServerRightColumn(
  serverId: string | undefined,
  voiceChannelId: string | undefined
): { right: RightColumn; chatOverlay: boolean } {
  // Com uma busca deste servidor aberta, os resultados tomam o lugar dos membros.
  const searchOpen = useSearchStore((s) => s.scope?.kind === 'server' && s.scope.id === serverId)
  const voiceChatOpen = useVoiceChatPanelStore(
    (s) => s.channelId !== null && s.channelId === voiceChannelId
  )
  const wide = useMediaQuery(VOICE_CHAT_WIDE_QUERY, true)
  return {
    right: rightColumnFor({ searchOpen, voiceChatOpen, wide }),
    chatOverlay: voiceChatOpen && !wide
  }
}
