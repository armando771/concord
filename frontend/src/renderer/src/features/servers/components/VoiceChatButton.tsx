import { useNavigate } from 'react-router-dom'
import { useCallStore } from '../../call/store/callStore'
import { useVoiceChatPanelStore } from '../../chat/store/voiceChatPanelStore'
import { ChatBubbleIcon } from '../../../shared/ui/icons'
import { knockView } from '../lib/voiceChannelRow'

/**
 * No toque o alvo cresce para 40×40 sem mudar o desenho de 20 px: a área extra
 * vai para cima, para baixo e para a esquerda (à direita fica o "•••").
 */
const TOUCH_AREA =
  "before:absolute before:inset-0 before:content-[''] pointer-coarse:before:-inset-y-2.5 pointer-coarse:before:-left-5"
/** Com o "Convidar amigos" ao lado (8 px), a área extra à esquerda encolhe para não invadir o dele. */
const TOUCH_AREA_BESIDE_INVITE =
  "before:absolute before:inset-0 before:content-[''] pointer-coarse:before:-inset-y-2.5 pointer-coarse:before:-left-1"

interface VoiceChatButtonProps {
  serverId: string | undefined
  channelId: string
  /** O "•••" ocupa a ponta direita: o balão fica à esquerda dele. */
  besideMenu: boolean
  /** O "Convidar amigos" fica à esquerda do balão. */
  besideInvite?: boolean
}

/**
 * Balão "Abrir chat" na linha do canal de voz: abre a tela do canal com o chat
 * à direita, conectado ou não. Na tela estreita (toque) fica sempre visível;
 * do sm em diante, no hover ou no foco do teclado.
 */
function VoiceChatButton({
  serverId,
  channelId,
  besideMenu,
  besideInvite = false
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
        besideInvite ? TOUCH_AREA_BESIDE_INVITE : TOUCH_AREA
      } ${
        besideMenu ? 'right-7' : 'right-1.5'
      }`}
    >
      <ChatBubbleIcon className="h-3.5 w-3.5" />
    </button>
  )
}

export default VoiceChatButton
