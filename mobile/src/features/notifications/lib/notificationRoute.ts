export type NotificationRoute = { pathname: string; params?: Record<string, string> }

const text = (v: unknown): string | undefined => (typeof v === 'string' && v !== '' ? v : undefined)

function dmRoute(d: Record<string, unknown>): NotificationRoute | null {
  const id = text(d.conversation_id)
  if (!id) return null
  const type = d.conversation_type === 'group' ? 'group' : 'dm'
  return { pathname: '/dm/[conversationId]', params: { conversationId: id, name: text(d.name) ?? '', type } }
}

function mentionRoute(d: Record<string, unknown>): NotificationRoute | null {
  const id = text(d.channel_id)
  if (!id) return null
  return { pathname: '/canal/[channelId]', params: { channelId: id, name: text(d.name) ?? '', serverId: text(d.server_id) ?? '' } }
}

/** Traduz o `data` do push (ver backend/internal/push/notifier.go) na tela que a notificação abre. */
export function routeForNotification(data: Record<string, unknown> | undefined): NotificationRoute | null {
  if (!data) return null
  switch (data.type) {
    case 'dm':
      return dmRoute(data)
    case 'mention':
      return mentionRoute(data)
    case 'friend_request':
      return { pathname: '/amigos' }
    default:
      return null
  }
}
