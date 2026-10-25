import { beforeEach, describe, expect, it, vi } from 'vitest'

// ─── Mocks dos módulos que o store usa ──────────────────────────────────────

const ws = vi.hoisted(() => ({
  config: null as null | { onOpen?: (reconnected: boolean) => void; onEvent: (e: unknown) => void }
}))
vi.mock('../api/ws', () => ({
  WsClient: class {
    constructor(config: never) {
      ws.config = config
    }
    connect = vi.fn()
    disconnect = vi.fn()
    subscribe = vi.fn()
    unsubscribe = vi.fn()
    sendEvent = vi.fn()
    isConnected = (): boolean => true
  }
}))
const messagesApi = vi.hoisted(() => ({
  listChannelMessages: vi.fn(),
  listConversationMessages: vi.fn()
}))
vi.mock('../api/messages', () => ({
  MESSAGE_LIMIT: 50,
  listChannelMessages: messagesApi.listChannelMessages,
  listConversationMessages: messagesApi.listConversationMessages,
  sendChannelMessage: vi.fn(),
  deleteChannelMessage: vi.fn(),
  addChannelReaction: vi.fn(),
  removeChannelReaction: vi.fn(),
  sendConversationMessage: vi.fn(),
  deleteConversationMessage: vi.fn(),
  addConversationReaction: vi.fn(),
  removeConversationReaction: vi.fn(),
  createPoll: vi.fn(),
  votePoll: vi.fn(),
  endPoll: vi.fn()
}))
vi.mock('../api/conversations', () => ({ listConversations: vi.fn(async () => []) }))
vi.mock('../api/presence', () => ({ fetchPresence: vi.fn(async () => ({})) }))
vi.mock('../api/channels', () => ({ listChannels: vi.fn(async () => []) }))
vi.mock('./serverStore', () => ({
  useServerStore: {
    getState: () => ({
      currentServer: null,
      fetchServers: vi.fn(async () => {}),
      fetchChannels: vi.fn()
    })
  }
}))
vi.mock('./friendStore', () => ({
  useFriendStore: { getState: () => ({ loadAll: vi.fn(async () => {}) }) }
}))
vi.mock('./callStore', () => ({
  useCallStore: { getState: () => ({ handleWsReconnect: vi.fn(), handleWsEvent: vi.fn() }) }
}))
vi.mock('./levelStore', () => ({
  useLevelStore: {
    getState: () => ({ loadMe: vi.fn(async () => {}), handleWsEvent: vi.fn(), reset: vi.fn() })
  }
}))
vi.mock('./authStore', () => ({
  useAuthStore: { getState: () => ({ accessToken: 'tok', user: { id: 'eu', username: 'eu' } }) }
}))
vi.mock('./toastStore', () => ({
  showToast: { info: vi.fn(), success: vi.fn(), error: vi.fn() },
  useToastStore: { getState: () => ({ removeToast: vi.fn() }) }
}))
vi.mock('./notificationPrefsStore', () => ({ notificationPrefs: () => ({}) }))
vi.mock('../lib/notifications', () => ({
  mentionNotification: () => null,
  messageNotification: () => null,
  notificationSound: () => null,
  notifyDesktop: vi.fn()
}))
vi.mock('../lib/sounds', () => ({ playSound: vi.fn() }))
vi.mock('../router', () => ({ router: { navigate: vi.fn() } }))

import { useChatStore } from './chatStore'

const at = (minute: number): string => `2026-10-25T10:${String(minute).padStart(2, '0')}:00Z`
const msg = (id: string, minute: number, channel: string): Record<string, unknown> => ({
  id,
  author_id: 'ana',
  channel_id: channel,
  content: id,
  created_at: at(minute)
})
/** API: da mais nova para a mais antiga. */
const page = (...list: Record<string, unknown>[]): Record<string, unknown>[] => [...list].reverse()
const ids = (room: string): string[] =>
  (useChatStore.getState().messagesByRoom[room] ?? []).map((m) => m.id)

beforeEach(() => {
  useChatStore.getState().reset()
  vi.clearAllMocks()
})

describe('chatStore — reconexão (deploy)', () => {
  it('relê só as salas carregadas e só conta como não lido o que é novo', async () => {
    messagesApi.listChannelMessages.mockImplementation(async (id: string) =>
      id === 'a' ? page(msg('a1', 1, 'a')) : page(msg('b1', 1, 'b'))
    )
    await useChatStore.getState().openRoom('channel:a')
    await useChatStore.getState().openRoom('channel:b') // a fica carregada, mas não ativa

    // Canal c nunca aberto: só recebeu uma mensagem solta pelo WS.
    ws.config!.onEvent({
      type: 'message:create',
      payload: { message: msg('c9', 9, 'c'), server_id: 's1' }
    })
    expect(useChatStore.getState().unreadByRoom['channel:c']).toBe(1)

    // Na queda chegou a2 em a; c tem 50 mensagens antigas no servidor.
    messagesApi.listChannelMessages.mockReset()
    messagesApi.listChannelMessages.mockImplementation(async (id: string) => {
      if (id === 'a') return page(msg('a1', 1, 'a'), msg('a2', 2, 'a'))
      if (id === 'b') return page(msg('b1', 1, 'b'))
      return page(...Array.from({ length: 50 }, (_, i) => msg(`c${i}`, i % 60, 'c')))
    })

    await useChatStore.getState().resyncAfterReconnect()

    const fetched = messagesApi.listChannelMessages.mock.calls.map((c) => c[0])
    expect(fetched.sort()).toEqual(['a', 'b'])
    expect(useChatStore.getState().unreadByRoom['channel:c']).toBe(1)
    expect(ids('channel:c')).toEqual(['c9'])
    expect(ids('channel:a')).toEqual(['a1', 'a2'])
    expect(useChatStore.getState().unreadByRoom['channel:a']).toBe(1)
    // A sala aberta não ganha não lidas.
    expect(useChatStore.getState().unreadByRoom['channel:b']).toBe(0)
  })

  it('sala fechada não é mais relida', async () => {
    messagesApi.listChannelMessages.mockResolvedValue(page(msg('a1', 1, 'a')))
    await useChatStore.getState().openRoom('channel:a')
    useChatStore.getState().closeRoom('channel:a')
    messagesApi.listChannelMessages.mockClear()

    await useChatStore.getState().resyncAfterReconnect()

    expect(messagesApi.listChannelMessages).not.toHaveBeenCalled()
  })
})
