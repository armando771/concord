import { describe, expect, it } from 'vitest'
import type { Message } from '../../api/messages'
import type { ConversationSummary } from '../../api/conversations'
import type { ChatState } from '../chatStore'
import { withArrivedMessage, withConversationOnTop, type Arrival } from './messageCreate'

// As contas da mensagem que chega (não lidas e menções). O fluxo inteiro
// (aviso, pendentes, DM) está em chatStore.notify.test e chatStore.order.test.

const msg = (extra: Partial<Message> = {}): Message =>
  ({
    id: 'm1',
    author_id: 'ana',
    channel_id: 'c1',
    content: 'oi',
    created_at: 't1',
    ...extra
  }) as Message

const empty = {
  activeRoom: null,
  messagesByRoom: {},
  unreadByRoom: {},
  unreadByServer: {},
  mentionsByRoom: {},
  mentionsByServer: {}
} as unknown as ChatState

const arrival = (extra: Partial<Arrival> = {}): Arrival => ({
  msg: msg(),
  room: 'channel:c1',
  serverId: 's1',
  decision: null,
  ...extra
})

describe('withArrivedMessage', () => {
  it('canal sem regra: soma não lida na sala e no servidor, sem menção', () => {
    const next = withArrivedMessage(empty, arrival(), { open: false, meId: 'me' })
    expect(next.unreadByRoom).toEqual({ 'channel:c1': 1 })
    expect(next.unreadByServer).toEqual({ s1: 1 })
    expect(next.mentionsByRoom).toBe(empty.mentionsByRoom)
    expect(next.messagesByRoom).toBe(empty.messagesByRoom)
  })

  it('menção num canal silenciado: só o selo de menção', () => {
    const decision = { notify: true, unread: false, mention: true }
    const next = withArrivedMessage(empty, arrival({ decision }), { open: false, meId: 'me' })
    expect(next.unreadByRoom).toBe(empty.unreadByRoom)
    expect(next.unreadByServer).toBe(empty.unreadByServer)
    expect(next.mentionsByRoom).toEqual({ 'channel:c1': 1 })
    expect(next.mentionsByServer).toEqual({ s1: 1 })
  })

  it('sala aberta e à vista: entra na lista sem contar', () => {
    const state = { ...empty, activeRoom: 'channel:c1' } as ChatState
    const decision = { notify: true, unread: true, mention: true }
    const next = withArrivedMessage(state, arrival({ decision }), { open: true, meId: 'me' })
    expect(next.messagesByRoom).toEqual({ 'channel:c1': [msg()] })
    expect(next.unreadByRoom).toBe(state.unreadByRoom)
    expect(next.mentionsByRoom).toBe(state.mentionsByRoom)
  })

  it('minha mensagem não conta', () => {
    const next = withArrivedMessage(empty, arrival(), { open: false, meId: 'ana' })
    expect(next.unreadByRoom).toBe(empty.unreadByRoom)
  })

  it('DM: conta na sala, não em servidor', () => {
    const dm = arrival({
      msg: msg({ channel_id: null, conversation_id: 'd1' }),
      room: 'conversation:d1',
      serverId: null
    })
    const next = withArrivedMessage(empty, dm, { open: false, meId: 'me' })
    expect(next.unreadByRoom).toEqual({ 'conversation:d1': 1 })
    expect(next.unreadByServer).toBe(empty.unreadByServer)
  })
})

describe('withConversationOnTop', () => {
  const conv = (id: string): ConversationSummary => ({ id, type: 'dm' }) as ConversationSummary

  it('sobe a DM com a prévia da mensagem', () => {
    const next = withConversationOnTop(
      [conv('a'), conv('d1')],
      msg({ channel_id: null, conversation_id: 'd1' })
    )
    expect(next.conversations?.map((c) => c.id)).toEqual(['d1', 'a'])
    expect(next.conversations?.[0].last_message).toEqual({
      id: 'm1',
      author_id: 'ana',
      content: 'oi',
      created_at: 't1'
    })
  })

  it('conversa fora da lista: nada muda', () => {
    expect(withConversationOnTop([conv('a')], msg({ conversation_id: 'zz' }))).toEqual({})
  })
})
