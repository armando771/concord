import { act, renderHook } from '@testing-library/react-native'
import { realtime } from '../../../shared/api/realtime'
import type { WsEvent } from '../../../shared/api/ws'
import { useAuthStore } from '../../auth/store/authStore'
import { useServersStore } from '../../servers/store/serversStore'
import type { ConversationSummary } from '../api/conversations'
import type { Message } from '../api/messages'
import { useActiveRoomStore } from '../store/activeRoomStore'
import { useConversationsStore } from '../store/conversationsStore'
import { useUnreadStore } from '../store/unreadStore'
import { useUnreadLive } from './useUnreadLive'

let wsHandler: (event: WsEvent) => void = () => {}
jest.mock('../../../shared/api/ws', () => ({
  onWsEvent: jest.fn((l: (e: WsEvent) => void) => ((wsHandler = l), () => {}))
}))
jest.mock('../../../shared/api/realtime', () => ({
  realtime: { subscribe: jest.fn() },
  onRealtimeReconnect: jest.fn(() => () => {})
}))

const conv = (id: string, unread = 0): ConversationSummary => ({
  id,
  type: 'dm',
  name: '',
  members: [],
  unread_count: unread,
  created_at: '2026-10-28T10:00:00Z',
  updated_at: '2026-10-28T10:00:00Z'
})
const message = (over: Partial<Message>): Message => ({
  id: 'm',
  author_id: 'outra',
  content: 'oi',
  created_at: '2026-10-28T11:00:00Z',
  ...over
})
const emit = (m: Message, extra: object = {}) => act(async () => wsHandler({ type: 'message:create', payload: { message: m, ...extra } }))

describe('useUnreadLive', () => {
  const load = jest.fn().mockResolvedValue(undefined)

  beforeEach(() => {
    jest.clearAllMocks()
    useAuthStore.setState({ status: 'signedIn', user: { id: 'eu', username: 'eu', display_name: 'Eu', email: 'e@x.co' } })
    useUnreadStore.setState(useUnreadStore.getInitialState(), true)
    useActiveRoomStore.setState({ active: null })
    useServersStore.setState({ ...useServersStore.getInitialState(), servers: [{ id: 's1', name: 'A', owner_id: 'u' }] })
    useConversationsStore.setState({ ...useConversationsStore.getInitialState(), conversations: [conv('d1')], load })
  })

  it('carrega as conversas e assina a sala de cada servidor', async () => {
    await renderHook(() => useUnreadLive())
    expect(load).toHaveBeenCalled()
    expect(realtime.subscribe).toHaveBeenCalledWith('server:s1')
  })

  it('DM nova de outra pessoa com o chat fechado: +1 não lida', async () => {
    await renderHook(() => useUnreadLive())
    await emit(message({ conversation_id: 'd1' }))
    expect(useConversationsStore.getState().conversations[0].unread_count).toBe(1)
  })

  it('DM com o chat aberto não conta; a minha também não', async () => {
    await renderHook(() => useUnreadLive())
    useActiveRoomStore.setState({ active: { kind: 'conversation', id: 'd1' } })
    await emit(message({ conversation_id: 'd1' }))
    useActiveRoomStore.setState({ active: null })
    await emit(message({ conversation_id: 'd1', author_id: 'eu' }))
    expect(useConversationsStore.getState().conversations[0].unread_count).toBe(0)
  })

  it('mensagem de canal fechado acende o servidor; a do canal aberto não', async () => {
    await renderHook(() => useUnreadLive())
    await emit(message({ channel_id: 'c1' }), { server_id: 's1' })
    expect(useUnreadStore.getState().byServer.s1).toBe(1)
    useActiveRoomStore.setState({ active: { kind: 'channel', id: 'c1' } })
    await emit(message({ id: 'm2', channel_id: 'c1' }), { server_id: 's1' })
    expect(useUnreadStore.getState().byServer.s1).toBe(1)
  })

  it('deslogado: não carrega nem assina nada', async () => {
    useAuthStore.setState({ status: 'signedOut' })
    await renderHook(() => useUnreadLive())
    expect(load).not.toHaveBeenCalled()
    expect(realtime.subscribe).not.toHaveBeenCalled()
  })

  it('eventos que não são message:create ou sem mensagem são ignorados', async () => {
    await renderHook(() => useUnreadLive())
    await act(async () => wsHandler({ type: 'presence:update', payload: { user_id: 'x' } }))
    await act(async () => wsHandler({ type: 'message:create', payload: null }))
    expect(useConversationsStore.getState().conversations[0].unread_count).toBe(0)
    expect(useUnreadStore.getState().byServer).toEqual({})
  })
})
