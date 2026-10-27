import SearchResultsPanel from '../../chat/components/SearchResultsPanel'
import VoiceChatPanel from '../../chat/components/VoiceChatPanel'
import ServerMemberList from './ServerMemberList'
import type { RightColumn } from '../lib/serverLayout'
import type { Server } from '../api/servers'

interface ServerRightPanelProps {
  right: RightColumn
  server: Server
  channelId: string | undefined
}

/** A coluna da direita: resultados da busca, chat da call ou membros. */
function ServerRightPanel({ right, server, channelId }: ServerRightPanelProps): React.JSX.Element {
  if (right === 'search') {
    return (
      <SearchResultsPanel scope={{ kind: 'server', id: server.id }} currentChannelId={channelId} />
    )
  }
  if (right === 'voiceChat' && channelId) return <VoiceChatPanel channelId={channelId} />
  return <ServerMemberList server={server} />
}

export default ServerRightPanel
