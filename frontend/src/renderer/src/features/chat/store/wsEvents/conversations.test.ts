import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ChatState } from '../chatStore'
import type { ChatWsContext } from './context'

const nav = vi.hoisted(() => ({ navigate: vi.fn() }))
vi.mock('../../../../app/router', () => ({ router: nav }))

const { CONVERSATION_HANDLERS } = await import('./conversations')

function fakeCtx(initial: Partial<ChatState>): { ctx: ChatWsContext; state: () => ChatState } {
  let state = {
    conversations: [],
    unreadByRoom: {},
    activeRoom: null,
    closeRoom: vi.fn(),
    fetchConversations: vi.fn(async () => {}),
    ...initial
  } as unknown as ChatState
  const ctx = {
    set: (next) => {
      state = { ...state, ...next(state) }
    },
    get: () => state
  } as ChatWsContext
  return { ctx, state: () => state }
}

const send = (type: string, payload: Record<string, unknown>, ctx: ChatWsContext): void =>
  CONVERSATION_HANDLERS[type](payload, ctx, { type, payload })

beforeEach(() => vi.clearAllMocks())

describe('eventos de conversa', () => {
  it.each(['conversation:create', 'conversation:update'])(
    '%s relê a lista (só com conversation_id)',
    (type) => {
      const { ctx, state } = fakeCtx({})
      send(type, {}, ctx)
      expect(state().fetchConversations).not.toHaveBeenCalled()
      send(type, { conversation_id: 'd1' }, ctx)
      expect(state().fetchConversations).toHaveBeenCalledTimes(1)
    }
  )

  it('conversation:read zera as não lidas da DM', () => {
    const { ctx, state } = fakeCtx({ unreadByRoom: { 'conversation:d1': 3 } })
    send('conversation:read', {}, ctx)
    expect(state().unreadByRoom['conversation:d1']).toBe(3)
    send('conversation:read', { conversation_id: 'd1' }, ctx)
    expect(state().unreadByRoom['conversation:d1']).toBe(0)
  })

  it('conversation:remove do grupo aberto: some da lista e volta para Amigos', () => {
    const { ctx, state } = fakeCtx({
      activeRoom: 'conversation:g1',
      conversations: [
        { id: 'g1', type: 'group' },
        { id: 'd2', type: 'dm' }
      ] as ChatState['conversations']
    })
    send('conversation:remove', { conversation_id: 'g1' }, ctx)
    expect(state().conversations.map((c) => c.id)).toEqual(['d2'])
    expect(state().closeRoom).toHaveBeenCalledWith('conversation:g1')
    expect(nav.navigate).toHaveBeenCalledWith('/friends')
  })

  it('conversation:remove de DM ou de grupo fechado não muda a tela', () => {
    const { ctx, state } = fakeCtx({
      activeRoom: 'conversation:d2',
      conversations: [
        { id: 'g1', type: 'group' },
        { id: 'd2', type: 'dm' }
      ] as ChatState['conversations']
    })
    send('conversation:remove', { conversation_id: 'd2' }, ctx)
    send('conversation:remove', { conversation_id: 'g1' }, ctx)
    send('conversation:remove', {}, ctx)
    expect(state().conversations).toEqual([])
    expect(nav.navigate).not.toHaveBeenCalled()
  })
})
