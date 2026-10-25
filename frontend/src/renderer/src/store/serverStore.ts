import { create } from 'zustand'
import type { Server, ServerMember } from '../api/servers'
import type { ServerInvite } from '../api/invites'
import type { Channel, ChannelType } from '../api/channels'
import { useAuthStore } from './authStore'
import {
  listServers,
  getServer,
  createServer as apiCreateServer,
  inviteMember as apiInviteMember,
  updateServer as apiUpdateServer,
  deleteServer as apiDeleteServer
} from '../api/servers'
import { listServerInvites } from '../api/invites'
import {
  listChannels as apiListChannels,
  createChannel as apiCreateChannel,
  updateChannel as apiUpdateChannel,
  deleteChannel as apiDeleteChannel,
  reorderChannels as apiReorderChannels
} from '../api/channels'
import { applyChannelOrder } from '../lib/channelOrder'

interface ServerState {
  servers: Server[]
  currentServer: Server | null
  currentMembers: ServerMember[]
  serverInvites: ServerInvite[]
  channels: Channel[]
  loading: boolean
  fetchServers: () => Promise<void>
  selectServer: (id: string) => Promise<void>
  fetchServerInvites: (serverId: string) => Promise<void>
  fetchChannels: (serverId: string) => Promise<void>
  addServer: (name: string, icon_url?: string) => Promise<Server>
  inviteUser: (serverId: string, userId: string) => Promise<void>
  createChannel: (serverId: string, name: string, type?: ChannelType) => Promise<void>
  updateChannel: (serverId: string, channelId: string, name: string) => Promise<void>
  deleteChannel: (serverId: string, channelId: string) => Promise<void>
  /**
   * Nova ordem de uma seção: aplica na hora e manda ao servidor; se ele
   * recusar, volta a ordem de antes e repassa o erro.
   */
  reorderChannels: (serverId: string, type: ChannelType, channelIds: string[]) => Promise<void>
  /** Aplica uma ordem na lista local (sem falar com o servidor). */
  applyChannelOrder: (serverId: string, type: ChannelType, channelIds: string[]) => void
  /**
   * Ordem que chegou pelo WS (channel:reorder). Ignora o eco das próprias
   * reordenações; com uma nossa a caminho, adia e ressincroniza no fim.
   */
  receiveChannelOrder: (
    serverId: string,
    type: ChannelType,
    channelIds: string[],
    requestId?: string
  ) => void
  updateServer: (serverId: string, name: string, iconUrl?: string) => Promise<void>
  deleteServer: (serverId: string) => Promise<void>
  updateLocalServer: (server: Server) => void
  removeLocalServer: (serverId: string) => void
  addMember: (serverId: string, member: ServerMember) => void
  removeMember: (serverId: string, userId: string) => void
  /** Cargo mudou (ex.: virou moderador). */
  updateMember: (serverId: string, member: ServerMember) => void
  clearCurrentServer: () => void
  reset: () => void
}

// Reordenação de canais: uma fila por seção (servidor + tipo). Os pedidos saem
// um de cada vez, então um mais novo nunca é ultrapassado por um mais antigo.
interface ReorderSection {
  /** Último pedido da fila (o próximo espera ele terminar). */
  queue: Promise<unknown>
  /** Pedidos ainda sem resposta. */
  inFlight: number
  /** Conta as reordenações locais; falha só desfaz se nenhuma veio depois. */
  generation: number
  /** Chegou ordem de outra pessoa no meio: buscar a lista ao terminar. */
  stale: boolean
}
const reorderSections = new Map<string, ReorderSection>()
const reorderSection = (serverId: string, type: ChannelType): ReorderSection => {
  const key = `${serverId}:${type}`
  let section = reorderSections.get(key)
  if (!section) {
    section = { queue: Promise.resolve(), inFlight: 0, generation: 0, stale: false }
    reorderSections.set(key, section)
  }
  return section
}
/** request_id das nossas reordenações, para ignorar o eco pelo WS. */
const ownReorderRequests = new Set<string>()
const OWN_REQUEST_TTL_MS = 60_000
const newRequestId = (): string =>
  globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`

const isSameSession = (tokenAtStart: string | null): boolean =>
  useAuthStore.getState().accessToken === tokenAtStart

const refetchOnFocus = (): void => {
  if (!useAuthStore.getState().accessToken) return
  useServerStore.getState().fetchServers()
}

if (typeof window !== 'undefined') {
  window.addEventListener('focus', refetchOnFocus)
}

export const useServerStore = create<ServerState>()((set, get) => ({
  servers: [],
  currentServer: null,
  currentMembers: [],
  serverInvites: [],
  channels: [],
  loading: false,
  fetchServers: async () => {
    const token = useAuthStore.getState().accessToken
    try {
      const servers = await listServers()
      if (!isSameSession(token)) return
      set({ servers: Array.isArray(servers) ? servers : [] })
    } catch {
      if (isSameSession(token)) set({ servers: [] })
    }
  },
  selectServer: async (id: string) => {
    const token = useAuthStore.getState().accessToken
    set({ loading: true })
    try {
      const res = await getServer(id)
      if (!isSameSession(token)) return
      set({ currentServer: res.server, currentMembers: res.members })
    } catch (err) {
      if (isSameSession(token)) set({ currentServer: null, currentMembers: [] })
      throw err
    } finally {
      set({ loading: false })
    }
  },
  fetchServerInvites: async (serverId: string) => {
    const token = useAuthStore.getState().accessToken
    try {
      const invites = await listServerInvites(serverId)
      if (!isSameSession(token)) return
      set({ serverInvites: Array.isArray(invites) ? invites : [] })
    } catch {
      if (isSameSession(token)) set({ serverInvites: [] })
    }
  },
  fetchChannels: async (serverId: string) => {
    const token = useAuthStore.getState().accessToken
    try {
      const channels = await apiListChannels(serverId)
      if (!isSameSession(token)) return
      set({ channels: Array.isArray(channels) ? channels : [] })
    } catch {
      if (isSameSession(token)) set({ channels: [] })
    }
  },
  addServer: async (name: string, icon_url?: string) => {
    const newServer = await apiCreateServer({ name, icon_url })
    set({ servers: [...get().servers, newServer] })
    return newServer
  },
  createChannel: async (serverId: string, name: string, type?: ChannelType) => {
    await apiCreateChannel(serverId, name, type)
    await get().fetchChannels(serverId)
  },
  updateChannel: async (serverId: string, channelId: string, name: string) => {
    await apiUpdateChannel(serverId, channelId, name)
    await get().fetchChannels(serverId)
  },
  deleteChannel: async (serverId: string, channelId: string) => {
    await apiDeleteChannel(serverId, channelId)
    await get().fetchChannels(serverId)
  },
  reorderChannels: async (serverId, type, channelIds) => {
    const section = reorderSection(serverId, type)
    const previous = get()
      .channels.filter((c) => (c.type ?? 'text') === type)
      .map((c) => c.id)
    const generation = ++section.generation
    get().applyChannelOrder(serverId, type, channelIds)

    const requestId = newRequestId()
    ownReorderRequests.add(requestId)
    setTimeout(() => ownReorderRequests.delete(requestId), OWN_REQUEST_TTL_MS)

    section.inFlight++
    const sent = section.queue.then(() => apiReorderChannels(serverId, type, channelIds, requestId))
    section.queue = sent.catch(() => {})
    try {
      await sent
    } catch (err) {
      // Só volta se nada mais novo foi feito depois; de todo jeito busca a
      // lista do servidor (a nossa pode estar velha: canal criado/apagado).
      if (section.generation === generation) get().applyChannelOrder(serverId, type, previous)
      section.stale = true
      throw err
    } finally {
      section.inFlight--
      if (section.inFlight === 0 && section.stale) {
        section.stale = false
        void get().fetchChannels(serverId)
      }
    }
  },
  receiveChannelOrder: (serverId, type, channelIds, requestId) => {
    if (requestId && ownReorderRequests.delete(requestId)) return
    const section = reorderSections.get(`${serverId}:${type}`)
    if (section && section.inFlight > 0) {
      section.stale = true
      return
    }
    get().applyChannelOrder(serverId, type, channelIds)
  },
  applyChannelOrder: (serverId, type, channelIds) => {
    if (get().currentServer?.id !== serverId) return
    const channels = applyChannelOrder(get().channels, type, channelIds)
    if (channels !== get().channels) set({ channels })
  },
  updateServer: async (serverId: string, name: string, iconUrl?: string) => {
    const updated = await apiUpdateServer(serverId, { name, icon_url: iconUrl ?? '' })
    set({ servers: get().servers.map((s) => (s.id === serverId ? updated : s)) })
    if (get().currentServer?.id === serverId) {
      set({ currentServer: updated })
    }
  },
  deleteServer: async (serverId: string) => {
    await apiDeleteServer(serverId)
    set({ servers: get().servers.filter((s) => s.id !== serverId) })
    if (get().currentServer?.id === serverId) {
      set({ currentServer: null, currentMembers: [], channels: [] })
    }
  },
  updateLocalServer: (server) => {
    set({
      servers: get().servers.map((s) => (s.id === server.id ? { ...s, ...server } : s)),
      currentServer:
        get().currentServer?.id === server.id
          ? { ...get().currentServer, ...server }
          : get().currentServer
    })
  },
  removeLocalServer: (serverId) => {
    set({
      servers: get().servers.filter((s) => s.id !== serverId),
      currentServer: get().currentServer?.id === serverId ? null : get().currentServer,
      currentMembers: get().currentServer?.id === serverId ? [] : get().currentMembers,
      channels: get().currentServer?.id === serverId ? [] : get().channels,
      serverInvites: get().currentServer?.id === serverId ? [] : get().serverInvites
    })
  },
  addMember: (serverId, member) => {
    if (get().currentServer?.id === serverId) {
      const exists = get().currentMembers.some((m) => m.user_id === member.user_id)
      if (!exists) {
        set({ currentMembers: [...get().currentMembers, member] })
      }
    }
  },
  updateMember: (serverId, member) => {
    if (get().currentServer?.id === serverId) {
      set({
        currentMembers: get().currentMembers.map((m) =>
          m.user_id === member.user_id ? { ...m, ...member } : m
        )
      })
    }
  },
  removeMember: (serverId, userId) => {
    if (get().currentServer?.id === serverId) {
      set({ currentMembers: get().currentMembers.filter((m) => m.user_id !== userId) })
    }
  },
  inviteUser: async (serverId: string, userId: string) => {
    await apiInviteMember(serverId, userId)
    await get().fetchServerInvites(serverId)
    if (get().currentServer?.id === serverId) {
      await get().selectServer(serverId)
    }
  },
  clearCurrentServer: () => set({ currentServer: null, currentMembers: [], channels: [] }),
  reset: () =>
    set({
      servers: [],
      currentServer: null,
      currentMembers: [],
      serverInvites: [],
      channels: [],
      loading: false
    })
}))
