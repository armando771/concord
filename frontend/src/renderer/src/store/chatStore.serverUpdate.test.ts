import { beforeEach, describe, expect, it, vi } from 'vitest'

// server:update traz o servidor inteiro: aplica como patch, sem recarregar o
// servidor aberto (o recarregar trocava a tela pelo "Carregando servidor...").

vi.mock('../api/messages', () => ({
  MESSAGE_LIMIT: 50,
  listChannelMessages: vi.fn(async () => []),
  listConversationMessages: vi.fn(async () => []),
  sendChannelMessage: vi.fn(),
  sendConversationMessage: vi.fn(),
  deleteChannelMessage: vi.fn(),
  deleteConversationMessage: vi.fn(),
  addChannelReaction: vi.fn(),
  removeChannelReaction: vi.fn(),
  addConversationReaction: vi.fn(),
  removeConversationReaction: vi.fn(),
  createPoll: vi.fn(),
  votePoll: vi.fn(),
  endPoll: vi.fn()
}))
vi.mock('../api/ws', () => ({
  WsClient: class {
    connect = vi.fn()
    disconnect = vi.fn()
    subscribe = vi.fn()
    unsubscribe = vi.fn()
    sendEvent = vi.fn()
    isConnected = (): boolean => true
  }
}))
vi.mock('../api/conversations', () => ({ listConversations: vi.fn(async () => []) }))
vi.mock('../api/presence', () => ({ fetchPresence: vi.fn(async () => ({})) }))
vi.mock('../api/channels', () => ({ listChannels: vi.fn(async () => []) }))
vi.mock('../router', () => ({ router: { navigate: vi.fn() } }))
vi.mock('../lib/sounds', () => ({ playSound: vi.fn() }))
vi.mock('../lib/notifications', () => ({
  messageNotification: () => null,
  mentionNotification: () => null,
  notificationSound: () => null,
  notifyDesktop: vi.fn(),
  deliverDesktop: vi.fn(),
  messageAlert: () => null
}))
vi.mock('./authStore', () => ({
  useAuthStore: {
    getState: () => ({ accessToken: 'tok', user: { id: 'me', username: 'me', status: 'online' } })
  }
}))
const servers = vi.hoisted(() => ({
  updateLocalServer: vi.fn(),
  selectServer: vi.fn(async () => {}),
  currentServer: { id: 's1' } as { id: string } | null
}))
vi.mock('./serverStore', () => ({ useServerStore: { getState: () => servers } }))
// O chatStore consulta quem está bloqueado e se a janela tem foco.
vi.mock('./friendStore', () => ({ useFriendStore: { getState: () => ({ blocked: [] }) } }))
vi.stubGlobal('document', { hasFocus: () => false })
vi.mock('./callStore', () => ({ useCallStore: { getState: () => ({}) } }))
vi.mock('./levelStore', () => ({ useLevelStore: { getState: () => ({}) } }))
vi.mock('./soundboardStore', () => ({ useSoundboardStore: { getState: () => ({}) } }))
vi.mock('./profileStore', () => ({ useProfileStore: { getState: () => ({}) } }))
vi.mock('./toastStore', () => ({ showToast: {} }))
vi.mock('./notificationPrefsStore', () => ({ notificationPrefs: () => ({}) }))

const { useChatStore } = await import('./chatStore')

const send = (payload: Record<string, unknown>): void =>
  useChatStore.getState().handleWsEvent({ type: 'server:update', payload } as never)

beforeEach(() => {
  servers.updateLocalServer.mockClear()
  servers.selectServer.mockClear()
  servers.currentServer = { id: 's1' }
})

describe('server:update', () => {
  it('com o servidor no evento: só aplica por cima, sem recarregar', () => {
    const server = { id: 's1', name: 'Novo nome', owner_id: 'ana' }
    send({ server_id: 's1', server })
    expect(servers.updateLocalServer).toHaveBeenCalledWith(server)
    expect(servers.selectServer).not.toHaveBeenCalled()
  })

  it('sem o servidor no evento: relê o aberto por baixo', () => {
    send({ server_id: 's1' })
    expect(servers.selectServer).toHaveBeenCalledWith('s1')
  })

  it('sem o servidor no evento e outro aberto: não faz nada', () => {
    servers.currentServer = { id: 's2' }
    send({ server_id: 's1' })
    expect(servers.selectServer).not.toHaveBeenCalled()
    expect(servers.updateLocalServer).not.toHaveBeenCalled()
  })
})
