// Canais criados, editados, reordenados ou apagados no servidor.
import type { ChatState, RoomKey } from '../chatStore'
import type { Payload, WsHandler } from './context'
import { useChannelNameStore } from '../../../servers/store/channelNameStore'
import { useServerStore } from '../../../servers/store/serverStore'
import { router } from '../../../../app/router'

interface ChannelReorder {
  server_id: string
  type: 'text' | 'voice'
  channel_ids: string[]
  request_id?: string
}

const refreshChannels: WsHandler = (payload, ctx) => {
  const serverId = payload.server_id as string
  if (!serverId) return
  useChannelNameStore.getState().invalidate(serverId)
  useServerStore.getState().fetchChannels(serverId)
  ctx.get().fetchChannelsForServers([serverId])
}

/** A nova ordem dos canais de um tipo, ou null se o evento veio incompleto. */
export function channelReorderOf(payload: Payload): ChannelReorder | null {
  const r = payload as Partial<ChannelReorder>
  const kindOk = r.type === 'text' || r.type === 'voice'
  return r.server_id && kindOk && Array.isArray(r.channel_ids) ? (r as ChannelReorder) : null
}

const handleReorder: WsHandler = (payload) => {
  const reorder = channelReorderOf(payload)
  if (!reorder) return
  useServerStore
    .getState()
    .receiveChannelOrder(reorder.server_id, reorder.type, reorder.channel_ids, reorder.request_id)
}

/** Some a sala do canal apagado (mensagens e não lidas) e, se era a aberta, ela fecha. */
export function withoutChannelRoom(
  state: ChatState,
  room: RoomKey,
  serverId: string
): Partial<ChatState> {
  const messagesByRoom = { ...state.messagesByRoom }
  delete messagesByRoom[room]
  const unreadByRoom = { ...state.unreadByRoom }
  delete unreadByRoom[room]
  const unreadByServer = { ...state.unreadByServer }
  delete unreadByServer[serverId]
  return {
    messagesByRoom,
    unreadByRoom,
    unreadByServer,
    activeRoom: state.activeRoom === room ? null : state.activeRoom
  }
}

const handleDelete: WsHandler = (payload, ctx) => {
  const serverId = payload.server_id as string
  const channelId = payload.channel_id as string
  if (serverId) useChannelNameStore.getState().invalidate(serverId)
  if (!serverId || !channelId) return
  const room = `channel:${channelId}`
  ctx.set((state) => withoutChannelRoom(state, room, serverId))
  ctx.dropRoom(room)
  useServerStore.getState().fetchChannels(serverId)
  ctx.get().fetchChannelsForServers([serverId])
  if (ctx.get().activeRoom === null) router.navigate(`/servers/${serverId}`)
}

export const CHANNEL_HANDLERS: Record<string, WsHandler> = {
  'channel:create': refreshChannels,
  'channel:update': refreshChannels,
  'channel:reorder': handleReorder,
  'channel:delete': handleDelete
}
