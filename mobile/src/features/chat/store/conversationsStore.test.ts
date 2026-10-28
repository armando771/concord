import { listFriends } from '../../friends/api/friends'
import { listConversations, type ConversationPerson, type ConversationSummary } from '../api/conversations'
import type { Message } from '../api/messages'
import { useConversationsStore } from './conversationsStore'

jest.mock('../api/conversations')
jest.mock('../../friends/api/friends')

const list = jest.mocked(listConversations)
const friends = jest.mocked(listFriends)
const state = () => useConversationsStore.getState()

const person = (id: string, name: string): ConversationPerson => ({ id, username: id, display_name: name })
const dm = (id: string, at: string): ConversationSummary => ({
  id,
  type: 'dm',
  name: '',
  other_user: person(`u-${id}`, id),
  members: [],
  unread_count: 0,
  created_at: at,
  updated_at: at
})
const msg = (conversationId: string, at: string): Message => ({
  id: 'm1',
  author_id: 'x',
  conversation_id: conversationId,
  content: 'oi',
  created_at: at
})

describe('conversationsStore', () => {
  beforeEach(() => {
    jest.resetAllMocks()
    useConversationsStore.setState(useConversationsStore.getInitialState(), true)
  })

  it('load guarda as conversas, da mais recente para a mais antiga', async () => {
    list.mockResolvedValue([dm('a', '2026-10-28T10:00:00Z'), dm('b', '2026-10-28T11:00:00Z')])
    await state().load()
    expect(state().conversations.map((c) => c.id)).toEqual(['b', 'a'])
    expect(state().status).toBe('ready')
  })

  it('falha: status erro e mantém o que já tinha', async () => {
    list.mockResolvedValueOnce([dm('a', '2026-10-28T10:00:00Z')])
    await state().load()
    list.mockRejectedValueOnce(new Error('rede'))
    await state().load()
    expect(state().status).toBe('error')
    expect(state().conversations).toHaveLength(1)
  })

  it('applyMessage sobe a conversa existente sem ir à rede', async () => {
    list.mockResolvedValueOnce([dm('a', '2026-10-28T10:00:00Z'), dm('b', '2026-10-28T09:00:00Z')])
    await state().load()
    await state().applyMessage(msg('b', '2026-10-28T12:00:00Z'))
    expect(state().conversations.map((c) => c.id)).toEqual(['b', 'a'])
    expect(list).toHaveBeenCalledTimes(1)
  })

  it('applyMessage de conversa desconhecida refaz a lista', async () => {
    list.mockResolvedValueOnce([dm('a', '2026-10-28T10:00:00Z')])
    await state().load()
    list.mockResolvedValueOnce([dm('novo', '2026-10-28T13:00:00Z'), dm('a', '2026-10-28T10:00:00Z')])
    await state().applyMessage(msg('novo', '2026-10-28T13:00:00Z'))
    expect(state().conversations.map((c) => c.id)).toEqual(['novo', 'a'])
  })

  it('loadFriends guarda uma vez e não busca de novo', async () => {
    friends.mockResolvedValue([person('f1', 'Ana')])
    await state().loadFriends()
    await state().loadFriends()
    expect(friends).toHaveBeenCalledTimes(1)
    expect(state().friends.map((f) => f.id)).toEqual(['f1'])
  })

  it('falha dos amigos não derruba a lista e deixa tentar de novo depois', async () => {
    friends.mockRejectedValueOnce(new Error('x')).mockResolvedValueOnce([person('f1', 'Ana')])
    await state().loadFriends()
    expect(state().friends).toEqual([])
    await state().loadFriends()
    expect(state().friends).toHaveLength(1)
  })

  it('reset limpa tudo (logout)', async () => {
    list.mockResolvedValue([dm('a', '2026-10-28T10:00:00Z')])
    await state().load()
    state().reset()
    expect(state().conversations).toEqual([])
    expect(state().status).toBe('idle')
  })
})
