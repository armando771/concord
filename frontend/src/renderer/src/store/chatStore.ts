import { create } from 'zustand'
import type { ServerMember } from '../api/servers'
import {
  mentionNotification,
  messageNotification,
  notificationSound,
  notifyDesktop
} from '../lib/notifications'
import { playSound } from '../lib/sounds'
import { notificationPrefs } from './notificationPrefsStore'
import { useAuthStore } from './authStore'
import { WsClient, type WsEvent } from '../api/ws'
import type { CreatePollInput, Message, Poll } from '../api/messages'
import type { Server } from '../api/servers'
import {
  listChannelMessages,
  sendChannelMessage,
  deleteChannelMessage,
  listConversationMessages,
  sendConversationMessage,
  deleteConversationMessage,
  createPoll,
  votePoll,
  endPoll
} from '../api/messages'
import { applyPollUpdate, messagePreview, type PollUpdate } from '../lib/polls'
import type { ConversationSummary } from '../api/conversations'
import { listConversations } from '../api/conversations'
import type { PresenceMap } from '../api/presence'
import { fetchPresence } from '../api/presence'
import { listChannels } from '../api/channels'
import { useServerStore } from './serverStore'
import { useFriendStore } from './friendStore'
import { useCallStore } from './callStore'
import { useLevelStore } from './levelStore'
import { showToast } from './toastStore'
import { router } from '../router'
import { MESSAGE_LIMIT } from '../api/messages'

export type RoomKey = string

interface ChatState {
  messagesByRoom: Record<RoomKey, Message[]>
  hasMoreByRoom: Record<RoomKey, boolean>
  loadingByRoom: Record<RoomKey, boolean>
  unreadByRoom: Record<RoomKey, number>
  unreadByServer: Record<string, number>
  channelsByServer: Record<string, string[]>
  activeRoom: RoomKey | null
  presence: Record<string, boolean>
  conversations: ConversationSummary[]
  conversationsLoading: boolean
  connect: () => void
  disconnect: () => void
  isWsConnected: () => boolean
  openRoom: (room: RoomKey) => Promise<void>
  closeRoom: (room: RoomKey) => void
  openServer: (serverId: string) => void
  closeServer: (serverId: string) => void
  loadOlder: (room: RoomKey) => Promise<void>
  sendToRoom: (room: RoomKey, content: string) => Promise<void>
  deleteFromRoom: (room: RoomKey, messageId: string) => Promise<void>
  createPollInRoom: (room: RoomKey, input: CreatePollInput) => Promise<void>
  votePollInRoom: (room: RoomKey, messageId: string, answerIds: number[]) => Promise<void>
  endPollInRoom: (room: RoomKey, messageId: string) => Promise<void>
  fetchConversations: () => Promise<void>
  fetchPresenceFor: (userIds: string[]) => Promise<void>
  fetchChannelsForServers: (serverIds: string[]) => Promise<void>
  sendEvent: (type: string, payload: unknown) => void
  subscribeRoom: (room: RoomKey) => void
  unsubscribeRoom: (room: RoomKey) => void
  handleWsEvent: (event: WsEvent) => void
  handleFriendRemoved: (userId: string) => void
  handleServerDeleted: (serverId: string) => void
  reset: () => void
}

const getRoomFetch = (room: RoomKey): ((before?: string) => Promise<Message[]>) => {
  if (room.startsWith('channel:')) {
    const id = room.slice('channel:'.length)
    return (before?: string) => listChannelMessages(id, before)
  }
  const id = room.slice('conversation:'.length)
  return (before?: string) => listConversationMessages(id, before)
}

const appendUnique = (messages: Message[], incoming: Message[]): Message[] => {
  const seen = new Set(messages.map((m) => m.id))
  const merged = [...messages]
  for (const msg of incoming) {
    if (!seen.has(msg.id)) {
      merged.push(msg)
      seen.add(msg.id)
    }
  }
  return merged
}

/** Troca a enquete de uma mensagem carregada na sala (sem efeito se não estiver). */
const replacePoll = (
  messagesByRoom: Record<RoomKey, Message[]>,
  room: RoomKey,
  messageId: string,
  next: (current: Poll | null | undefined) => Poll
): Record<RoomKey, Message[]> => {
  const messages = messagesByRoom[room]
  if (!messages?.some((m) => m.id === messageId)) return messagesByRoom
  return {
    ...messagesByRoom,
    [room]: messages.map((m) => (m.id === messageId ? { ...m, poll: next(m.poll) } : m))
  }
}

const client = new WsClient({
  getToken: () => useAuthStore.getState().accessToken,
  getUserId: () => useAuthStore.getState().user?.id ?? null,
  onEvent: (event) => useChatStore.getState().handleWsEvent(event)
})

/** Mensagens que já geraram notificação (chegam por mais de uma sala). */
const notifiedMessages = new Set<string>()

export const useChatStore = create<ChatState>()((set, get) => ({
  messagesByRoom: {},
  hasMoreByRoom: {},
  loadingByRoom: {},
  unreadByRoom: {},
  unreadByServer: {},
  channelsByServer: {},
  activeRoom: null,
  presence: {},
  conversations: [],
  conversationsLoading: false,

  connect: () => {
    client.connect()
    get().fetchConversations()
    void useLevelStore.getState().loadMe()
  },
  disconnect: () => {
    client.disconnect()
    get().reset()
    useLevelStore.getState().reset()
  },
  isWsConnected: () => client.isConnected(),

  openRoom: async (room) => {
    client.subscribe(room)
    const fetch = getRoomFetch(room)
    const token = useAuthStore.getState().accessToken
    set((state) => {
      const channelId = room.startsWith('channel:') ? room.slice('channel:'.length) : null
      let unreadByServer = state.unreadByServer
      if (channelId) {
        for (const [serverId, channels] of Object.entries(state.channelsByServer)) {
          if (channels.includes(channelId)) {
            unreadByServer = { ...state.unreadByServer, [serverId]: 0 }
            break
          }
        }
      }
      return {
        loadingByRoom: { ...state.loadingByRoom, [room]: true },
        activeRoom: room,
        unreadByRoom: { ...state.unreadByRoom, [room]: 0 },
        unreadByServer
      }
    })
    try {
      const fetched = await fetch()
      if (useAuthStore.getState().accessToken !== token) return
      set((state) => ({
        messagesByRoom: {
          ...state.messagesByRoom,
          [room]: appendUnique(state.messagesByRoom[room] ?? [], [...fetched].reverse())
        },
        hasMoreByRoom: { ...state.hasMoreByRoom, [room]: fetched.length >= MESSAGE_LIMIT }
      }))
    } catch (err) {
      console.error(`[chatStore] openRoom ${room} failed:`, err)
    } finally {
      set((state) => ({
        loadingByRoom: { ...state.loadingByRoom, [room]: false }
      }))
    }
  },

  closeRoom: (room) => {
    client.unsubscribe(room)
    set((state) => {
      const next = { ...state.messagesByRoom }
      delete next[room]
      return {
        messagesByRoom: next,
        activeRoom: state.activeRoom === room ? null : state.activeRoom
      }
    })
  },

  openServer: (serverId) => {
    client.subscribe(`server:${serverId}`)
  },

  closeServer: (serverId) => {
    client.unsubscribe(`server:${serverId}`)
  },

  loadOlder: async (room) => {
    const fetch = getRoomFetch(room)
    const current = get().messagesByRoom[room] ?? []
    if (current.length === 0) return
    const before = current[0].id
    const token = useAuthStore.getState().accessToken
    try {
      const fetched = await fetch(before)
      if (useAuthStore.getState().accessToken !== token) return
      if (fetched.length === 0) return
      set((state) => ({
        messagesByRoom: {
          ...state.messagesByRoom,
          [room]: [...[...fetched].reverse(), ...(state.messagesByRoom[room] ?? [])]
        },
        hasMoreByRoom: { ...state.hasMoreByRoom, [room]: fetched.length >= MESSAGE_LIMIT }
      }))
    } catch (err) {
      console.error(`[chatStore] loadOlder ${room} failed:`, err)
    }
  },

  sendToRoom: async (room, content) => {
    const trimmed = content.trim()
    if (!trimmed) return

    if (room.startsWith('channel:')) {
      await sendChannelMessage(room.slice('channel:'.length), trimmed)
    } else {
      await sendConversationMessage(room.slice('conversation:'.length), trimmed)
    }

    if (!client.isConnected()) {
      await get().openRoom(room)
    }
    get().fetchConversations()
  },

  deleteFromRoom: async (room, messageId) => {
    if (room.startsWith('channel:')) {
      await deleteChannelMessage(room.slice('channel:'.length), messageId)
    } else {
      await deleteConversationMessage(room.slice('conversation:'.length), messageId)
    }
    set((state) => ({
      messagesByRoom: {
        ...state.messagesByRoom,
        [room]: (state.messagesByRoom[room] ?? []).filter((m) => m.id !== messageId)
      }
    }))
  },

  createPollInRoom: async (room, input) => {
    await createPoll(room, input)
    if (!client.isConnected()) {
      await get().openRoom(room)
    }
    get().fetchConversations()
  },

  votePollInRoom: async (room, messageId, answerIds) => {
    const poll = await votePoll(room, messageId, answerIds)
    set((state) => ({
      messagesByRoom: replacePoll(state.messagesByRoom, room, messageId, () => poll)
    }))
  },

  endPollInRoom: async (room, messageId) => {
    const poll = await endPoll(room, messageId)
    set((state) => ({
      messagesByRoom: replacePoll(state.messagesByRoom, room, messageId, () => poll)
    }))
  },

  fetchConversations: async () => {
    const token = useAuthStore.getState().accessToken
    set({ conversationsLoading: true })
    try {
      const conversations = await listConversations()
      if (useAuthStore.getState().accessToken !== token) return
      set({ conversations: Array.isArray(conversations) ? conversations : [] })
      const ids = conversations.map((c) => c.other_user.id)
      if (ids.length > 0) await get().fetchPresenceFor(ids)
    } catch (err) {
      console.error('[chatStore] fetchConversations error:', err)
    } finally {
      set({ conversationsLoading: false })
    }
  },

  fetchPresenceFor: async (userIds) => {
    const unique = Array.from(new Set(userIds.filter(Boolean)))
    if (unique.length === 0) return
    const token = useAuthStore.getState().accessToken
    try {
      const map: PresenceMap = await fetchPresence(unique)
      if (useAuthStore.getState().accessToken !== token) return
      set((state) => ({ presence: { ...state.presence, ...map } }))
    } catch (err) {
      console.error('[chatStore] fetchPresenceFor error:', err)
    }
  },

  fetchChannelsForServers: async (serverIds) => {
    const unique = Array.from(new Set(serverIds.filter(Boolean)))
    if (unique.length === 0) return
    const token = useAuthStore.getState().accessToken
    try {
      const results = await Promise.all(unique.map((id) => listChannels(id)))
      if (useAuthStore.getState().accessToken !== token) return
      const map: Record<string, string[]> = {}
      unique.forEach((id, i) => {
        map[id] = Array.isArray(results[i]) ? results[i].map((c) => c.id) : []
      })
      set((state) => ({ channelsByServer: { ...state.channelsByServer, ...map } }))
    } catch (err) {
      console.error('[chatStore] fetchChannelsForServers error:', err)
    }
  },

  sendEvent: (type, payload) => {
    client.sendEvent(type, payload)
  },

  subscribeRoom: (room) => {
    client.subscribe(room)
  },

  unsubscribeRoom: (room) => {
    client.unsubscribe(room)
  },

  handleWsEvent: (event) => {
    const payload = event.payload as Record<string, unknown>

    if (event.type.startsWith('call:')) {
      useCallStore.getState().handleWsEvent(event)
      return
    }

    if (event.type.startsWith('level:')) {
      useLevelStore.getState().handleWsEvent(event)
      return
    }

    if (event.type === 'message:create') {
      const msg = payload.message as Message
      const room = msg.channel_id
        ? `channel:${msg.channel_id}`
        : `conversation:${msg.conversation_id}`
      const serverId = (payload.server_id as string) || null
      if (!room.endsWith(':')) {
        set((state) => {
          const nextMessages = {
            ...state.messagesByRoom,
            [room]: appendUnique(state.messagesByRoom[room] ?? [], [msg])
          }
          const isActive = room === state.activeRoom
          const nextUnread = isActive
            ? state.unreadByRoom
            : { ...state.unreadByRoom, [room]: (state.unreadByRoom[room] ?? 0) + 1 }
          const nextServerUnread =
            !isActive && serverId && msg.channel_id
              ? {
                  ...state.unreadByServer,
                  [serverId]: (state.unreadByServer[serverId] ?? 0) + 1
                }
              : state.unreadByServer
          return {
            messagesByRoom: nextMessages,
            unreadByRoom: nextUnread,
            unreadByServer: nextServerUnread
          }
        })

        // DM recebida ou menção a você num canal: notificação do Windows, aviso
        // na barra de tarefas e som — conforme Configurações → Notificações.
        // A mesma mensagem chega pela sala do canal e do servidor: avisa uma vez.
        const me = useAuthStore.getState().user
        if (me && !notifiedMessages.has(msg.id)) {
          notifiedMessages.add(msg.id)
          const notification =
            messageNotification(msg, me.id) ??
            mentionNotification(msg, { id: me.id, username: me.username }, serverId)
          if (notification) {
            const prefs = notificationPrefs()
            notifyDesktop(notification, prefs)
            const looking = room === get().activeRoom && document.hasFocus()
            const sound = notificationSound(notification.kind, prefs)
            if (!looking && sound) playSound(sound)
          }
        }

        if (msg.conversation_id) {
          const meId = useAuthStore.getState().user?.id
          const existing = get().conversations.find((c) => c.id === msg.conversation_id)
          if (existing) {
            set((state) => {
              const idx = state.conversations.findIndex((c) => c.id === msg.conversation_id)
              if (idx === -1) return {}
              const updated = [...state.conversations]
              updated[idx] = {
                ...updated[idx],
                last_message: {
                  id: msg.id,
                  author_id: msg.author_id,
                  content: messagePreview(msg),
                  created_at: msg.created_at
                }
              }
              const [conv] = updated.splice(idx, 1)
              updated.unshift(conv)
              return { conversations: updated }
            })
          } else if (msg.author_id !== meId && msg.author) {
            const author = msg.author
            set((state) => ({
              conversations: [
                {
                  id: msg.conversation_id as string,
                  user_a_id: msg.author_id,
                  user_b_id: meId ?? '',
                  created_at: msg.created_at,
                  updated_at: msg.created_at,
                  other_user: {
                    id: author.id,
                    username: author.username,
                    display_name: author.display_name
                  },
                  last_message: {
                    id: msg.id,
                    author_id: msg.author_id,
                    content: messagePreview(msg),
                    created_at: msg.created_at
                  }
                },
                ...state.conversations
              ]
            }))
          } else {
            void get().fetchConversations()
          }
        }
      }
      return
    }

    if (event.type === 'message:delete') {
      const messageId = payload.message_id as string
      const channelId = payload.channel_id as string | undefined
      const conversationId = payload.conversation_id as string | undefined
      const serverId = (payload.server_id as string) || null
      const room = channelId ? `channel:${channelId}` : `conversation:${conversationId}`
      set((state) => {
        const currentUnread = state.unreadByRoom[room] ?? 0
        const nextUnread =
          currentUnread > 0
            ? { ...state.unreadByRoom, [room]: currentUnread - 1 }
            : state.unreadByRoom
        const currentServerUnread = serverId ? (state.unreadByServer[serverId] ?? 0) : 0
        const nextServerUnread =
          serverId && channelId && currentServerUnread > 0
            ? { ...state.unreadByServer, [serverId]: currentServerUnread - 1 }
            : state.unreadByServer
        return {
          messagesByRoom: {
            ...state.messagesByRoom,
            [room]: (state.messagesByRoom[room] ?? []).filter((m) => m.id !== messageId)
          },
          unreadByRoom: nextUnread,
          unreadByServer: nextServerUnread
        }
      })
      return
    }

    if (event.type === 'message:poll:update') {
      const update = payload as unknown as PollUpdate & {
        message_id: string
        channel_id?: string
        conversation_id?: string
      }
      const room = update.channel_id
        ? `channel:${update.channel_id}`
        : `conversation:${update.conversation_id}`
      const meId = useAuthStore.getState().user?.id ?? null
      set((state) => ({
        messagesByRoom: replacePoll(state.messagesByRoom, room, update.message_id, (current) =>
          applyPollUpdate(current, update, meId)
        )
      }))
      return
    }

    if (event.type === 'channel:create') {
      const serverId = payload.server_id as string
      if (serverId) {
        useServerStore.getState().fetchChannels(serverId)
        get().fetchChannelsForServers([serverId])
      }
      return
    }

    if (event.type === 'channel:update') {
      const serverId = payload.server_id as string
      if (serverId) {
        useServerStore.getState().fetchChannels(serverId)
        get().fetchChannelsForServers([serverId])
      }
      return
    }

    if (event.type === 'channel:delete') {
      const serverId = payload.server_id as string
      const channelId = payload.channel_id as string
      if (serverId && channelId) {
        const room = `channel:${channelId}`
        set((state) => {
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
        })
        client.unsubscribe(room)
        useServerStore.getState().fetchChannels(serverId)
        get().fetchChannelsForServers([serverId])
        if (get().activeRoom === null) {
          router.navigate(`/servers/${serverId}`)
        }
      }
      return
    }

    if (event.type === 'server:update') {
      const serverId = payload.server_id as string
      const srv = payload.server as Server | undefined
      if (srv) {
        useServerStore.getState().updateLocalServer(srv)
      }
      if (serverId && useServerStore.getState().currentServer?.id === serverId) {
        void useServerStore.getState().selectServer(serverId)
      }
      return
    }

    if (event.type === 'server:delete') {
      const serverId = payload.server_id as string
      if (serverId) {
        get().handleServerDeleted(serverId)
        useServerStore.getState().removeLocalServer(serverId)
      }
      return
    }

    if (event.type === 'server:member:update') {
      const serverId = payload.server_id as string
      const member = payload.member as ServerMember
      if (serverId && member) useServerStore.getState().updateMember(serverId, member)
      return
    }

    if (event.type === 'server:member:join') {
      const serverId = payload.server_id as string
      const member = payload.member as {
        server_id: string
        user_id: string
        username: string
        display_name: string
        avatar_url?: string
        role: string
        joined_at: string
        updated_at: string
      }
      if (serverId && member) {
        useServerStore.getState().addMember(serverId, member)
      }
      return
    }

    if (event.type === 'server:member:leave') {
      const serverId = payload.server_id as string
      const userId = payload.user_id as string
      if (serverId && userId) {
        useServerStore.getState().removeMember(serverId, userId)
      }
      return
    }

    if (event.type === 'presence:update') {
      const userId = payload.user_id as string
      const online = Boolean(payload.online)
      set((state) => ({ presence: { ...state.presence, [userId]: online } }))
      return
    }

    const friendUser = payload.user as
      { id: string; username: string; display_name: string } | undefined

    if (event.type === 'friend:request') {
      useFriendStore.getState().loadAll()
      if (friendUser) {
        showToast.info(
          `${friendUser.display_name} (@${friendUser.username}) te enviou um pedido de amizade`
        )
      }
      return
    }

    if (event.type === 'friend:request:accepted') {
      useFriendStore.getState().loadAll()
      if (friendUser) {
        showToast.success(`${friendUser.display_name} aceitou seu pedido de amizade`)
      }
      return
    }

    if (event.type === 'friend:request:declined') {
      useFriendStore.getState().loadAll()
      if (friendUser) {
        showToast.info(`${friendUser.display_name} recusou seu pedido de amizade`)
      }
      return
    }

    if (event.type === 'friend:request:cancelled') {
      useFriendStore.getState().loadAll()
      if (friendUser) {
        showToast.info(`${friendUser.display_name} cancelou o pedido de amizade`)
      }
      return
    }

    if (event.type === 'friend:removed') {
      useFriendStore.getState().loadAll()
      if (friendUser) {
        get().handleFriendRemoved(friendUser.id)
        showToast.info(`${friendUser.display_name} não é mais seu amigo`)
      }
      return
    }
  },

  handleFriendRemoved: (userId) => {
    const removedIds = new Set(
      get()
        .conversations.filter((c) => c.other_user.id === userId)
        .map((c) => c.id)
    )
    if (removedIds.size === 0) return
    set((state) => {
      const isRemovedRoom = (room: string): boolean =>
        room.startsWith('conversation:') && removedIds.has(room.slice('conversation:'.length))
      return {
        conversations: state.conversations.filter((c) => !removedIds.has(c.id)),
        messagesByRoom: Object.fromEntries(
          Object.entries(state.messagesByRoom).filter(([room]) => !isRemovedRoom(room))
        ),
        unreadByRoom: Object.fromEntries(
          Object.entries(state.unreadByRoom).filter(([room]) => !isRemovedRoom(room))
        ),
        activeRoom: state.activeRoom && isRemovedRoom(state.activeRoom) ? null : state.activeRoom
      }
    })
    removedIds.forEach((convId) => client.unsubscribe(`conversation:${convId}`))
  },

  handleServerDeleted: (serverId) => {
    const channelIds = get().channelsByServer[serverId] ?? []
    const rooms = channelIds.map((cid) => `channel:${cid}`)
    const roomSet = new Set(rooms)
    set((state) => {
      const messagesByRoom = { ...state.messagesByRoom }
      const unreadByRoom = { ...state.unreadByRoom }
      rooms.forEach((room) => {
        delete messagesByRoom[room]
        delete unreadByRoom[room]
      })
      const unreadByServer = { ...state.unreadByServer }
      delete unreadByServer[serverId]
      const channelsByServer = { ...state.channelsByServer }
      delete channelsByServer[serverId]
      return {
        messagesByRoom,
        unreadByRoom,
        unreadByServer,
        channelsByServer,
        activeRoom: state.activeRoom && roomSet.has(state.activeRoom) ? null : state.activeRoom
      }
    })
    rooms.forEach((room) => client.unsubscribe(room))
    if (useServerStore.getState().currentServer?.id === serverId) {
      router.navigate('/friends')
    }
  },

  reset: () =>
    set({
      messagesByRoom: {},
      hasMoreByRoom: {},
      loadingByRoom: {},
      unreadByRoom: {},
      unreadByServer: {},
      channelsByServer: {},
      activeRoom: null,
      presence: {},
      conversations: [],
      conversationsLoading: false
    })
}))
