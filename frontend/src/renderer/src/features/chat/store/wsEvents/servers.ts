// O servidor e seus membros: edição, exclusão, entrada/saída de membros e as
// mudanças de cargos e permissões (que podem tirar a pessoa do canal aberto).
import type { WsEvent } from '../../../../shared/api/ws'
import type { RoomKey } from '../chatStore'
import type { ChatWsContext, WsHandler } from './context'
import type { Server, ServerMember } from '../../../servers/api/servers'
import { useServerStore } from '../../../servers/store/serverStore'
import { handleServerRoleEvent, removedMessage } from '../../../servers/store/serverEvents'
import { showToast } from '../../../../shared/store/toastStore'
import { router } from '../../../../app/router'

/** O canal aberto que sumiu da lista do servidor (a pessoa perdeu o acesso), ou null. */
export function lostChannelRoom(
  room: RoomKey | null,
  before: string[],
  after: string[]
): RoomKey | null {
  if (!room?.startsWith('channel:')) return null
  const open = room.slice('channel:'.length)
  return before.includes(open) && !after.includes(open) ? room : null
}

const channelsOf = (ctx: ChatWsContext, serverId: string): string[] =>
  ctx.get().channelsByServer[serverId] ?? []

async function refreshIfCurrent(serverId: string): Promise<void> {
  const servers = useServerStore.getState()
  if (servers.currentServer?.id === serverId) await servers.refreshServer(serverId)
}

/**
 * Relê o que a pessoa vê do servidor (cargos/canais mudaram) e, se o canal
 * aberto sumiu para ela, sai dele.
 */
export async function reconcileAfterPermissionChange(
  serverId: string,
  ctx: ChatWsContext
): Promise<void> {
  const before = channelsOf(ctx, serverId)
  await refreshIfCurrent(serverId)
  await ctx.get().fetchChannelsForServers([serverId])
  const lost = lostChannelRoom(ctx.get().activeRoom, before, channelsOf(ctx, serverId))
  if (!lost) return
  ctx.get().closeRoom(lost)
  void router.navigate(`/servers/${serverId}`)
}

/** Saiu, foi expulso ou banido: o servidor some e, se não foi por vontade própria, avisa. */
export function removeServer(serverId: string, reason: string, ctx: ChatWsContext): void {
  const name = useServerStore.getState().servers.find((s) => s.id === serverId)?.name
  ctx.get().handleServerDeleted(serverId)
  useServerStore.getState().removeLocalServer(serverId)
  const message = removedMessage(reason, name)
  if (message) showToast.error(message)
}

/** Cargos, permissões e saída do servidor (sair, expulsão, banimento). true = tratado. */
export const handleRoleEvent = (event: WsEvent, ctx: ChatWsContext): boolean =>
  handleServerRoleEvent(event, {
    onServerRemoved: (serverId, reason) => removeServer(serverId, reason, ctx),
    onPermissionsChanged: (serverId) => void reconcileAfterPermissionChange(serverId, ctx)
  })

const handleUpdate: WsHandler = (payload) => {
  const serverId = payload.server_id as string
  const srv = payload.server as Server | undefined
  const servers = useServerStore.getState()
  // O evento já traz o servidor inteiro: aplica por cima, sem recarregar.
  if (srv) servers.updateLocalServer(srv)
  else if (serverId && servers.currentServer?.id === serverId)
    servers.selectServer(serverId).catch(() => {})
}

const handleDelete: WsHandler = (payload, ctx) => {
  const serverId = payload.server_id as string
  if (!serverId) return
  ctx.get().handleServerDeleted(serverId)
  useServerStore.getState().removeLocalServer(serverId)
}

const handleMemberUpdate: WsHandler = (payload) => {
  const serverId = payload.server_id as string
  const member = payload.member as ServerMember
  if (serverId && member) useServerStore.getState().updateMember(serverId, member)
}

const handleMemberJoin: WsHandler = (payload) => {
  const serverId = payload.server_id as string
  const member = payload.member as Parameters<
    ReturnType<typeof useServerStore.getState>['addMember']
  >[1]
  if (serverId && member) useServerStore.getState().addMember(serverId, member)
}

const handleMemberLeave: WsHandler = (payload) => {
  const serverId = payload.server_id as string
  const userId = payload.user_id as string
  if (serverId && userId) useServerStore.getState().removeMember(serverId, userId)
}

export const SERVER_HANDLERS: Record<string, WsHandler> = {
  'server:update': handleUpdate,
  'server:delete': handleDelete,
  'server:member:update': handleMemberUpdate,
  'server:member:join': handleMemberJoin,
  'server:member:leave': handleMemberLeave
}
