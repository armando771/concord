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
  reorderChannels as apiReorderChannels,
  deleteChannel as apiDeleteChannel
} from '../api/channels'

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
  reorderChannels: (serverId: string, nextChannels: Channel[], sectionIds: string[]) => Promise<void>
  setChannels: (serverId: string, channels: Channel[]) => void
  deleteChannel: (serverId: string, channelId: string) => Promise<void>
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
  reorderChannels: async (serverId: string, nextChannels: Channel[], sectionIds: string[]) => {
    const previous = get().channels
    set({ channels: nextChannels })
    try {
      const updated = await apiReorderChannels(serverId, sectionIds)
      if (get().currentServer?.id === serverId && Array.isArray(updated)) {
        set({ channels: updated })
      }
    } catch (err) {
      if (get().currentServer?.id === serverId) {
        set({ channels: previous })
      }
      throw err
    }
  },
  setChannels: (serverId: string, channels: Channel[]) => {
    if (get().currentServer?.id === serverId) {
      set({ channels })
    }
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
