import { useNavigate } from 'react-router-dom'
import { useCallStore } from '../../call/store/callStore'
import { useVoiceChatPanelStore } from '../../chat/store/voiceChatPanelStore'
import { ChatBubbleIcon } from '../../../shared/ui/icons'
import { knockView } from '../lib/voiceChannelRow'

interface VoiceChatButtonProps {
  serverId: string | undefined
  channelId: string
  /** O "•••" ocupa a ponta direita: o balão fica à esquerda dele. */
  besideMenu: boolean
}

/**
 * Balão "Abrir chat" na linha do canal de voz: abre a tela do canal com o chat
 * à direita, conectado ou não. Na tela estreita (toque) fica sempre visível;
 * do sm em diante, no hover ou no foco do teclado.
 */
function VoiceChatButton({
  serverId,
  channelId,
  besideMenu
}: VoiceChatButtonProps): React.JSX.Element | null {
  const navigate = useNavigate()
  const openChat = useVoiceChatPanelStore((s) => s.open)
  // O pedido para entrar (sala trancada) tem o próprio botão nesse canto.
  const knocking = useCallStore((s) => knockView(s.knock, channelId) !== null)
  if (knocking || !serverId) return null
  const open = (e: React.MouseEvent): void => {
    e.stopPropagation()
    openChat(channelId)
    navigate(`/servers/${serverId}/channels/${channelId}`)
  }
  return (
    <button
      type="button"
      onClick={open}
      aria-label="Abrir chat"
      title="Abrir chat"
      className={`absolute top-1.5 z-20 flex h-5 w-5 cursor-pointer items-center justify-center rounded-md text-gray-400 transition-[color,background-color,opacity] hover:bg-fg/10 hover:text-strong focus-visible:opacity-100 sm:opacity-0 sm:group-hover/voicech:opacity-100 ${
        besideMenu ? 'right-7' : 'right-1.5'
      }`}
    >
      <ChatBubbleIcon className="h-3.5 w-3.5" />
    </button>
  )
}

export default VoiceChatButton
