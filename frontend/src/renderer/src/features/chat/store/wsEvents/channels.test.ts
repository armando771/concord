import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ChatState } from '../chatStore'
import type { ChatWsContext } from './context'

const servers = vi.hoisted(() => ({ fetchChannels: vi.fn(), receiveChannelOrder: vi.fn() }))
const names = vi.hoisted(() => ({ invalidate: vi.fn() }))
const nav = vi.hoisted(() => ({ navigate: vi.fn() }))
vi.mock('../../../servers/store/serverStore', () => ({
  useServerStore: { getState: () => servers }
}))
vi.mock('../../../servers/store/channelNameStore', () => ({
  useChannelNameStore: { getState: () => names }
}))
vi.mock('../../../../app/router', () => ({ router: nav }))

const { CHANNEL_HANDLERS, channelReorderOf, withoutChannelRoom } = await import('./channels')

function fakeCtx(initial: Partial<ChatState>): { ctx: ChatWsContext; state: () => ChatState } {
  let state = {
    messagesByRoom: {},
    unreadByRoom: {},
    unreadByServer: {},
    activeRoom: null,
    fetchChannelsForServers: vi.fn(),
    ...initial
  } as unknown as ChatState
  const ctx = {
    set: (next) => {
      state = { ...state, ...next(state) }
    },
    get: () => state,
    isRoomOpen: () => true,
    dropRoom: vi.fn(),
    settleEcho: vi.fn(),
    claimNotification: () => true,
    markReadSoon: vi.fn()
  } as ChatWsContext
  return { ctx, state: () => state }
}

const send = (type: string, payload: Record<string, unknown>, ctx: ChatWsContext): void =>
  CHANNEL_HANDLERS[type](payload, ctx, { type, payload })

beforeEach(() => vi.clearAllMocks())

describe('channelReorderOf', () => {
  it('aceita a ordem de canais de texto ou voz', () => {
    const ok = { server_id: 's1', type: 'voice', channel_ids: ['a', 'b'], request_id: 'r' }
    expect(channelReorderOf(ok)).toEqual(ok)
  })

  it.each([
    ['sem servidor', { type: 'text', channel_ids: [] }],
    ['tipo desconhecido', { server_id: 's1', type: 'forum', channel_ids: [] }],
    ['sem lista', { server_id: 's1', type: 'text' }]
  ])('recusa evento incompleto (%s)', (_, payload) => {
    expect(channelReorderOf(payload)).toBeNull()
  })
})

describe('eventos de canal', () => {
  it('channel:reorder repassa a ordem ao serverStore', () => {
    const { ctx } = fakeCtx({})
    send('channel:reorder', { server_id: 's1', type: 'text', channel_ids: ['b', 'a'] }, ctx)
    expect(servers.receiveChannelOrder).toHaveBeenCalledWith('s1', 'text', ['b', 'a'], undefined)
    send('channel:reorder', { server_id: 's1', type: 'x', channel_ids: [] }, ctx)
    expect(servers.receiveChannelOrder).toHaveBeenCalledTimes(1)
  })

  it.each(['channel:create', 'channel:update'])('%s relê os canais do servidor', (type) => {
    const { ctx, state } = fakeCtx({})
    send(type, { server_id: 's1' }, ctx)
    expect(names.invalidate).toHaveBeenCalledWith('s1')
    expect(servers.fetchChannels).toHaveBeenCalledWith('s1')
    expect(state().fetchChannelsForServers).toHaveBeenCalledWith(['s1'])
    send(type, {}, ctx)
    expect(servers.fetchChannels).toHaveBeenCalledTimes(1)
  })

  it('channel:delete do canal aberto: limpa a sala, sai dela e volta ao servidor', () => {
    const { ctx, state } = fakeCtx({
      activeRoom: 'channel:c1',
      messagesByRoom: { 'channel:c1': [], 'channel:c2': [] },
      unreadByRoom: { 'channel:c1': 2 },
      unreadByServer: { s1: 2 }
    })
    send('channel:delete', { server_id: 's1', channel_id: 'c1' }, ctx)
    expect(state().messagesByRoom).toEqual({ 'channel:c2': [] })
    expect(state().unreadByRoom).toEqual({})
    expect(state().unreadByServer).toEqual({})
    expect(state().activeRoom).toBeNull()
    expect(ctx.dropRoom).toHaveBeenCalledWith('channel:c1')
    expect(servers.fetchChannels).toHaveBeenCalledWith('s1')
    expect(nav.navigate).toHaveBeenCalledWith('/servers/s1')
  })

  it('channel:delete de outro canal não tira a pessoa de onde está', () => {
    const { ctx, state } = fakeCtx({ activeRoom: 'channel:c2' })
    send('channel:delete', { server_id: 's1', channel_id: 'c1' }, ctx)
    expect(state().activeRoom).toBe('channel:c2')
    expect(nav.navigate).not.toHaveBeenCalled()
  })

  it('channel:delete sem canal só invalida os nomes', () => {
    const { ctx } = fakeCtx({})
    send('channel:delete', { server_id: 's1' }, ctx)
    expect(names.invalidate).toHaveBeenCalledWith('s1')
    expect(ctx.dropRoom).not.toHaveBeenCalled()
  })
})

describe('withoutChannelRoom', () => {
  it('mantém a sala ativa quando é outra', () => {
    const state = {
      messagesByRoom: {},
      unreadByRoom: {},
      unreadByServer: {},
      activeRoom: 'x'
    } as unknown as ChatState
    expect(withoutChannelRoom(state, 'channel:c1', 's1').activeRoom).toBe('x')
  })
})
