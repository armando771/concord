import { isVoiceChatOpen, useVoiceChatPanelStore } from '../store/voiceChatPanelStore'
import { useServerStore } from '../../servers/store/serverStore'
import { useChannelBadge } from '../../servers/hooks/useChannelBadge'
import { ChatBubbleIcon } from '../../../shared/ui/icons'

/**
 * Botão do chat na tela do canal de voz (conectado ou não): abre ou fecha o
 * painel à direita. Fechado, mostra as não lidas/menções do chat.
 */
function VoiceChatToggle({ channelId }: { channelId: string }): React.JSX.Element {
  const open = useVoiceChatPanelStore(isVoiceChatOpen(channelId))
  const toggle = useVoiceChatPanelStore((s) => s.toggle)
  const badge = useChannelBadge(
    useServerStore((s) => s.currentServer?.id),
    channelId
  )
  const label = open ? 'Fechar chat' : 'Abrir chat'
  return (
    <button
      type="button"
      onClick={() => toggle(channelId)}
      aria-label={label}
      aria-pressed={open}
      title={label}
      className={`relative flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border transition-colors ${
        open
          ? 'border-brand/50 bg-brand/15 text-strong'
          : 'border-subtle bg-floating text-gray-300 hover:text-strong'
      }`}
    >
      <ChatBubbleIcon className="h-5 w-5" />
      {!open && badge && (
        <span className="absolute -right-1 -top-1 rounded-full bg-red-500 px-1.5 text-[10px] font-bold leading-4 text-white">
          {badge.label}
        </span>
      )}
    </button>
  )
}

export default VoiceChatToggle
