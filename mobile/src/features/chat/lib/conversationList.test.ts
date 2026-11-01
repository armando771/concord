import type { ConversationPerson, ConversationSummary } from '../api/conversations'
import type { Message } from '../api/messages'
import {
  applyMessage,
  bumpUnread,
  clearUnread,
  conversationSubtitle,
  conversationTitle,
  filterConversations,
  friendsWithoutConversation,
  peerIds,
  sortConversations
} from './conversationList'

const person = (id: string, name: string): ConversationPerson => ({ id, username: id, display_name: name })
const ME = person('me', 'Eu')
const dm = (id: string, other: ConversationPerson, at: string): ConversationSummary => ({
  id,
  type: 'dm',
  name: '',
  other_user: other,
  members: [ME, other],
  unread_count: 0,
  created_at: at,
  updated_at: at
})
const group = (id: string, name: string, members: ConversationPerson[], at: string): ConversationSummary => ({
  id,
  type: 'group',
  name,
  members: [ME, ...members],
  unread_count: 0,
  created_at: at,
  updated_at: at
})
const T1 = '2026-10-28T10:00:00Z'
const T2 = '2026-10-28T11:00:00Z'
const T3 = '2026-10-28T12:00:00Z'
const ids = (l: ConversationSummary[]) => l.map((c) => c.id)

describe('conversationTitle / conversationSubtitle', () => {
  it('DM: nome do outro; grupo: nome do grupo', () => {
    expect(conversationTitle(dm('d', person('u1', 'Paulo'), T1), 'me')).toBe('Paulo')
    expect(conversationTitle(group('g', 'DEVS', [person('a', 'A')], T1), 'me')).toBe('DEVS')
  })

  it('grupo sem nome: nomes dos outros membros, sem você', () => {
    const g = group('g', '', [person('a', 'Ana'), person('b', 'Beto')], T1)
    expect(conversationTitle(g, 'me')).toBe('Ana, Beto')
  })

  it('subtítulo: "N membros" só no grupo', () => {
    expect(conversationSubtitle(group('g', 'DEVS', [person('a', 'A'), person('b', 'B')], T1))).toBe('3 membros')
    expect(conversationSubtitle(dm('d', person('u1', 'P'), T1))).toBeNull()
  })
})

describe('sortConversations', () => {
  it('mais recente primeiro: última mensagem, senão atualização', () => {
    const a = { ...dm('a', person('1', 'A'), T1), last_message: { id: 'm', author_id: '1', content: 'x', created_at: T3 } }
    const b = dm('b', person('2', 'B'), T2)
    const c = dm('c', person('3', 'C'), T1)
    expect(ids(sortConversations([c, b, a]))).toEqual(['a', 'b', 'c'])
  })
})

describe('applyMessage', () => {
  const msg = (conversationId: string, content = 'oi'): Message => ({
    id: 'm9',
    author_id: '1',
    conversation_id: conversationId,
    content,
    created_at: T3
  })

  it('atualiza a última mensagem e sobe a conversa', () => {
    const list = [dm('a', person('1', 'A'), T2), dm('b', person('2', 'B'), T1)]
    const result = applyMessage(list, msg('b', 'nova'))
    expect(result.unknown).toBe(false)
    expect(ids(result.list)).toEqual(['b', 'a'])
    expect(result.list[0].last_message?.content).toBe('nova')
  })

  it('conversa desconhecida: pede refazer a lista e não muda nada', () => {
    const list = [dm('a', person('1', 'A'), T1)]
    const result = applyMessage(list, msg('zzz'))
    expect(result.unknown).toBe(true)
    expect(result.list).toBe(list)
  })

  it('mensagem de canal (sem conversation_id) é ignorada', () => {
    const list = [dm('a', person('1', 'A'), T1)]
    const result = applyMessage(list, { id: 'm', author_id: '1', channel_id: 'c', content: 'x', created_at: T3 })
    expect(result).toEqual({ list, unknown: false })
  })
})

describe('filterConversations', () => {
  const list = [
    dm('a', person('1', 'Paulo Kogos'), T1),
    dm('b', person('2', 'Maria José'), T1),
    group('g', 'DEVS do SALINHA', [person('3', 'Zé'), person('4', 'Ana')], T1)
  ]

  it('sem texto: tudo', () => {
    expect(ids(filterConversations(list, '  ', 'me'))).toEqual(['a', 'b', 'g'])
  })

  it('ignora maiúsculas e acentos', () => {
    expect(ids(filterConversations(list, 'jose', 'me'))).toEqual(['b'])
    expect(ids(filterConversations(list, 'KOGOS', 'me'))).toEqual(['a'])
  })

  it('grupo casa pelo nome do grupo ou pelos nomes dos membros', () => {
    expect(ids(filterConversations(list, 'devs', 'me'))).toEqual(['g'])
    expect(ids(filterConversations(list, 'ana', 'me'))).toEqual(['g'])
  })
})

describe('friendsWithoutConversation', () => {
  const friends = [person('1', 'Paulo'), person('2', 'Maria'), person('9', 'Marcos')]
  const list = [dm('a', person('1', 'Paulo'), T1)]

  it('só amigos sem DM e que casam com o texto', () => {
    expect(friendsWithoutConversation(friends, list, 'mar').map((f) => f.id)).toEqual(['2', '9'])
    expect(friendsWithoutConversation(friends, list, 'paulo')).toEqual([])
  })

  it('sem texto não oferece ninguém (a busca só mostra amigos ao digitar)', () => {
    expect(friendsWithoutConversation(friends, list, '')).toEqual([])
  })
})

describe('bumpUnread / clearUnread', () => {
  it('+1 só na conversa pedida; clear zera e devolve a mesma lista se já era zero', () => {
    const list = [dm('a', person('1', 'A'), T1), dm('b', person('2', 'B'), T1)]
    const bumped = bumpUnread(list, 'b')
    expect(bumped.map((c) => c.unread_count)).toEqual([0, 1])
    expect(clearUnread(bumped, 'b').map((c) => c.unread_count)).toEqual([0, 0])
    expect(clearUnread(list, 'a')).toBe(list)
  })
})

describe('peerIds', () => {
  it('ids dos outros usuários das DMs 1 a 1 (grupo não tem bolinha)', () => {
    const list = [dm('a', person('1', 'A'), T1), group('g', 'G', [person('3', 'Z')], T1), dm('b', person('2', 'B'), T1)]
    expect(peerIds(list)).toEqual(['1', '2'])
  })
})
