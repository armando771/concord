import { createPortal } from 'react-dom'
import ChatPane from './ChatPane'
import { useVoiceChatPanelStore } from '../store/voiceChatPanelStore'
import { chatPermissionsFor } from '../lib/chatPermissions'
import { useServerStore } from '../../servers/store/serverStore'
import { useServerAccess } from '../../servers/hooks/useServerAccess'
import { useServerMentionable } from '../../servers/hooks/useServerMentionable'
import { useMediaQuery } from '../../../shared/hooks/useMediaQuery'
import { ChatBubbleIcon, XIcon } from '../../../shared/ui/icons'

/** Do md em diante o chat vira a coluna da direita da tela; antes, tela cheia. */
export const VOICE_CHAT_WIDE_QUERY = '(min-width: 768px)'

/**
 * Chat do canal de voz, na coluna da direita de cima a baixo, no lugar dos
 * membros (como o "Text in Voice" do Discord; ServerViewLayout). As mensagens são as do próprio canal: o mesmo ChatPane do canal
 * de texto, com as permissões do canal de voz.
 */
function VoiceChatPanel({ channelId }: { channelId: string }): React.JSX.Element {
  const serverId = useServerStore((s) => s.currentServer?.id)
  const name = useServerStore((s) => s.channels.find((c) => c.id === channelId)?.name) ?? 'voz'
  const access = useServerAccess()
  const mentionable = useServerMentionable()
  const close = useVoiceChatPanelStore((s) => s.close)
  const wide = useMediaQuery(VOICE_CHAT_WIDE_QUERY, true)
  const permissions = chatPermissionsFor(access.channelPerms(channelId))

  const panel = (
    <aside
      aria-label={`Chat de ${name}`}
      className={
        wide
          ? 'flex w-[clamp(18rem,32vw,26rem)] shrink-0 flex-col border-l border-subtle bg-primary'
          : 'fixed inset-0 z-50 flex flex-col bg-primary'
      }
    >
      {/* h-14: alinha com a barra do canal ao lado. */}
      <header className="flex h-14 shrink-0 items-center gap-2 border-b border-subtle pl-4 pr-2">
        <ChatBubbleIcon className="h-4 w-4 shrink-0 text-gray-400" />
        <h2 title={name} className="min-w-0 flex-1 truncate text-ds-md font-semibold text-strong">
          {name}
        </h2>
        <button
          type="button"
          onClick={close}
          aria-label="Fechar chat"
          title="Fechar chat"
          className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-lg text-gray-400 transition-colors hover:bg-fg/10 hover:text-strong"
        >
          <XIcon className="h-4 w-4" />
        </button>
      </header>
      <ChatPane
        room={`channel:${channelId}`}
        serverId={serverId}
        placeholder={`Mensagem para ${name}`}
        mentionable={mentionable}
        canMentionEveryone={permissions.canMentionEveryone}
        permissions={permissions}
      />
    </aside>
  )
  // Tela estreita: por cima de tudo (o backdrop-blur da tela do servidor
  // prenderia um `fixed` dentro dela).
  return wide ? panel : createPortal(panel, document.body)
}

export default VoiceChatPanel
