import { describe, expect, it } from 'vitest'
import type { Message } from '../api/messages'
import type { ConversationSummary } from '../api/conversations'
import { mapRoomMessage, replacePoll, withUpdatedMessage } from './roomMessages'

const msg = (id: string, extra: Partial<Message> = {}): Message =>
  ({ id, author_id: 'ana', content: id, created_at: 't', ...extra }) as Message

describe('withUpdatedMessage', () => {
  const conversations = [
    {
      id: 'd1',
      type: 'dm',
      last_message: { id: 'm1', author_id: 'ana', content: 'velho', created_at: 't' }
    }
  ] as ConversationSummary[]

  it('troca a mensagem na sala e a prévia da DM quando é a última', () => {
    const edited = msg('m1', {
      conversation_id: 'd1',
      content: 'novo',
      edited_at: 't2'
    } as Partial<Message>)
    const next = withUpdatedMessage(
      {
        messagesByRoom: { 'conversation:d1': [msg('m1', { conversation_id: 'd1' })] },
        conversations
      },
      'conversation:d1',
      edited
    )
    expect(next.messagesByRoom?.['conversation:d1'][0].content).toBe('novo')
    expect(next.conversations?.[0].last_message?.content).toBe('novo')
  })

  it('sala não carregada e mensagem que não é a última: nada muda', () => {
    const next = withUpdatedMessage(
      { messagesByRoom: {}, conversations },
      'conversation:d1',
      msg('m0', { conversation_id: 'd1' })
    )
    expect(next).toEqual({})
  })
})

describe('mapRoomMessage', () => {
  it('troca só a mensagem pedida (sala sem lista vira lista vazia)', () => {
    const rooms = { r: [msg('a'), msg('b')] }
    const next = mapRoomMessage(rooms, 'r', 'b', (m) => ({ ...m, content: 'x' }))
    expect(next.r.map((m) => m.content)).toEqual(['a', 'x'])
    expect(mapRoomMessage(rooms, 'outra', 'b', (m) => m).outra).toEqual([])
  })
})

describe('replacePoll', () => {
  it('sem a mensagem na sala devolve o mesmo mapa', () => {
    const rooms = { r: [msg('a')] }
    expect(replacePoll(rooms, 'r', 'zz', () => ({}) as never)).toBe(rooms)
  })
})
