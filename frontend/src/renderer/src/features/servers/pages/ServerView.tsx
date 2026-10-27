import { useEffect, useState } from 'react'
import {
  ChannelHeaderSkeleton,
  ComposerSkeleton,
  MemberListSkeleton,
  MessageListSkeleton
} from '../../../shared/ui/skeleton/layouts'
import { Navigate, useParams } from 'react-router-dom'
import { useServerStore } from '../store/serverStore'
import { useMusicStore } from '../../music/store/musicStore'
import { useFriendStore } from '../../friends/store/friendStore'
import { useUIStore } from '../../../shared/store/uiStore'
import { useChatStore } from '../../chat/store/chatStore'
import { showToast } from '../../../shared/store/toastStore'
import SearchResultsPanel from '../../chat/components/SearchResultsPanel'
import { useSearchStore } from '../../chat/store/searchStore'
import { useServerAccess } from '../hooks/useServerAccess'
import { chatPermissionsFor } from '../../chat/lib/chatPermissions'
import { Perm } from '../lib/permissions'
import {
  lastServerChannel,
  rememberServerChannel,
  resolveServerChannel
} from '../lib/serverChannel'
import ServerMemberList, { MembersAside } from '../components/ServerMemberList'
import ServerInviteModal from '../components/ServerInviteModal'
import ServerChannelContent from '../components/ServerChannelContent'
import { ChannelActions, ChannelTitle, ServerSearch } from '../components/ChannelHeaderParts'

export function ServerView(): React.JSX.Element {
  const { id, channelId } = useParams<{ id: string; channelId: string }>()

  const currentServer = useServerStore((s) => s.currentServer)
  const currentMembers = useServerStore((s) => s.currentMembers)
  const access = useServerAccess()
  const channels = useServerStore((s) => s.channels)
  const loading = useServerStore((s) => s.loading)
  const selectServer = useServerStore((s) => s.selectServer)
  const fetchChannels = useServerStore((s) => s.fetchChannels)

  const fetchPresenceFor = useChatStore((s) => s.fetchPresenceFor)

  const loadFriends = useFriendStore((s) => s.loadAll)

  const openInviteModal = useUIStore((s) => s.openServerInviteModal)
  const closeInviteModal = useUIStore((s) => s.closeServerInviteModal)

  const [pinsOpen, setPinsOpen] = useState(false)
  // Com uma busca deste servidor aberta, os resultados tomam o lugar dos membros.
  const searchOpen = useSearchStore((s) => s.scope?.kind === 'server' && s.scope.id === id)

  useEffect(() => {
    return () => closeInviteModal()
  }, [closeInviteModal])

  useEffect(() => {
    if (id) {
      selectServer(id).catch((err) => {
        showToast.error(err instanceof Error ? err.message : 'Falha ao carregar servidor.')
      })
      fetchChannels(id)
      useMusicStore
        .getState()
        .loadPresence(id)
        .catch(() => {})
    }
  }, [id, selectServer, fetchChannels])

  // Guarda o canal de texto aberto para voltar nele ao reabrir o servidor.
  useEffect(() => {
    setPinsOpen(false)
    if (!id || !channelId) return
    const ch = channels.find((c) => c.id === channelId && c.server_id === id)
    if (ch && (ch.type ?? 'text') === 'text') rememberServerChannel(id, channelId)
  }, [id, channelId, channels])

  useEffect(() => {
    if (currentMembers.length > 0) {
      fetchPresenceFor(currentMembers.map((m) => m.user_id))
    }
  }, [currentMembers, fetchPresenceFor])

  useEffect(() => {
    loadFriends()
  }, [loadFriends])

  // currentServer ainda é o anterior no 1º render após clicar noutro servidor.
  if (loading || !currentServer || currentServer.id !== id) {
    // O mesmo desenho da tela pronta (coluna central e lista de membros), em skeleton.
    return (
      <div className="flex h-full w-full overflow-hidden bg-primary text-gray-100">
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden border-r border-subtle">
          <ChannelHeaderSkeleton />
          <div className="min-h-0 flex-1">
            <MessageListSkeleton label="Carregando servidor…" />
          </div>
          <ComposerSkeleton />
        </div>
        <MembersAside>
          <MemberListSkeleton />
        </MembersAside>
      </div>
    )
  }

  // O que a pessoa pode no canal aberto; o servidor confere de novo ao gravar.
  const chatPermissions = chatPermissionsFor(channelId ? access.channelPerms(channelId) : 0)
  const activeChannel = channels.find((c) => c.id === channelId)

  if (!channelId) {
    // Só canais deste servidor: `channels` ainda é o do anterior até a busca voltar.
    const target = resolveServerChannel(
      id ?? '',
      currentServer,
      channels,
      id ? lastServerChannel(id) : null
    )
    if (target) return <Navigate to={`/servers/${id}/channels/${target}`} replace />
  }

  return (
    <div className="flex h-full w-full overflow-hidden bg-primary backdrop-blur-2xl text-gray-100">
      {/* Central Server View Column */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden border-r border-subtle">
        {/* Top Channel Header Bar */}
        <header className="relative flex h-14 shrink-0 items-center justify-between border-b border-subtle px-4">
          <div className="flex min-w-0 items-center gap-3">
            <ChannelTitle channel={activeChannel} fallback={currentServer.name} />
          </div>

          <div className="flex items-center gap-2">
            <ChannelActions
              channelId={channelId}
              isVoice={activeChannel?.type === 'voice'}
              pinsOpen={pinsOpen}
              onTogglePins={() => setPinsOpen((v) => !v)}
              onClosePins={() => setPinsOpen(false)}
              canInvite={access.can(Perm.CREATE_INVITE)}
              onInvite={openInviteModal}
              canModerate={chatPermissions.canModerate}
            />
            <ServerSearch server={currentServer} />
          </div>
        </header>

        <ServerChannelContent
          server={currentServer}
          channelId={channelId}
          channel={activeChannel}
          permissions={chatPermissions}
        />
      </div>

      {searchOpen ? (
        <SearchResultsPanel
          scope={{ kind: 'server', id: currentServer.id }}
          currentChannelId={channelId}
        />
      ) : (
        <ServerMemberList server={currentServer} />
      )}

      <ServerInviteModal server={currentServer} />
    </div>
  )
}

export default ServerView
