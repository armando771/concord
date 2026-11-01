import { useLocation, useNavigate } from 'react-router-dom'
import { useServerStore } from '../store/serverStore'
import { useChatStore } from '../../chat/store/chatStore'
import { useCallStore } from '../../call/store/callStore'
import { useServersVoiceActivity } from '../../call/hooks/useServersVoiceActivity'
import { voiceServerId } from '../../call/lib/voiceServer'
import { useNotifySettingsStore } from '../../notifications/store/notifySettingsStore'
import { isMutedNow } from '../../notifications/lib/notificationMute'
import { useNow } from '../../../shared/hooks/useNow'
import { ServerRailSkeleton } from '../../../shared/ui/skeleton/layouts'
import { serverRailView } from '../lib/serverRailView'
import ServerRailItem from './ServerRailItem'

/** Lista rolável dos servidores do usuário, com selos de não lidas, voz e o cartão de hover. */
function ServerRailList(): React.JSX.Element {
  const location = useLocation()
  const navigate = useNavigate()

  const servers = useServerStore((s) => s.servers)
  const serversLoaded = useServerStore((s) => s.serversLoaded)
  const voiceSrvId = useCallStore((s) => voiceServerId(s))
  const voiceActivity = useServersVoiceActivity(servers.map((srv) => srv.id))
  const unreadByServer = useChatStore((s) => s.unreadByServer)
  const mentionsByServer = useChatStore((s) => s.mentionsByServer)
  const notifyServers = useNotifySettingsStore((s) => s.servers)
  const openNotifyModal = useNotifySettingsStore((s) => s.openModal)
  const now = useNow()

  return (
    // O padding dá espaço aos selos (voz, não lidas), que ficam metade para fora do
    // ícone: sem ele o overflow da lista corta os selos.
    <div className="-my-1 flex flex-col gap-2 overflow-y-auto no-scrollbar px-2 py-2">
      {/* Só na primeira carga: depois a lista é trocada por baixo, sem piscar. */}
      {!serversLoaded && servers.length === 0 && <ServerRailSkeleton />}
      {servers.map((srv) => {
        const isActive = location.pathname === `/servers/${srv.id}`
        const people = voiceActivity.get(srv.id)
        const view = serverRailView({
          muted: isMutedNow(notifyServers[srv.id], now),
          isActive,
          mentions: mentionsByServer[srv.id],
          unread: unreadByServer[srv.id],
          inMyCall: srv.id === voiceSrvId,
          hasCall: people !== undefined
        })
        return (
          <ServerRailItem
            key={srv.id}
            name={srv.name}
            iconUrl={srv.icon_url}
            isActive={isActive}
            view={view}
            people={people}
            onOpen={() => navigate(`/servers/${srv.id}`)}
            onContextMenu={() => openNotifyModal({ serverId: srv.id, name: srv.name })}
          />
        )
      })}
    </div>
  )
}

export default ServerRailList
