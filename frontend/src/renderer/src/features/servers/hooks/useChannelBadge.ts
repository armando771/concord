import { useChatStore } from '../../chat/store/chatStore'
import { useNotifySettingsStore } from '../../notifications/store/notifySettingsStore'
import { resolveScope } from '../../notifications/lib/notificationMute'
import { useNow } from '../../../shared/hooks/useNow'
import { channelBadge, type ChannelBadge } from '../lib/channelBadge'

/** Selo de não lidas/menções do canal (o chat do canal de voz usa a mesma sala). */
export function useChannelBadge(
  serverId: string | undefined,
  channelId: string
): ChannelBadge | null {
  const room = `channel:${channelId}`
  const mentions = useChatStore((s) => s.mentionsByRoom[room] ?? 0)
  const unread = useChatStore((s) => s.unreadByRoom[room] ?? 0)
  const serverSettings = useNotifySettingsStore((s) => (serverId ? s.servers[serverId] : undefined))
  const channelSettings = useNotifySettingsStore((s) => s.channels[channelId])
  const now = useNow()
  return channelBadge(mentions, unread, resolveScope(serverSettings, channelSettings, now).muted)
}
