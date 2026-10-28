import type { ConversationSummary } from '../api/conversations'
import type { Message } from '../api/messages'
import { badgeText, shouldCountUnread, totalUnread, unreadLabel } from './unreadCounts'

const msg = (over: Partial<Message> = {}): Message => ({
  id: 'm1',
  author_id: 'outra',
  content: 'oi',
  created_at: '2026-10-28T10:00:00Z',
  ...over
})

describe('shouldCountUnread', () => {
  it('conta mensagem de outra pessoa num chat que não está aberto', () => {
    expect(shouldCountUnread(msg({ conversation_id: 'd1' }), 'eu', null)).toBe(true)
    expect(shouldCountUnread(msg({ channel_id: 'c1' }), 'eu', { kind: 'conversation', id: 'd1' })).toBe(true)
  })

  it('não conta a minha própria mensagem (nem a enviada de outro aparelho)', () => {
    expect(shouldCountUnread(msg({ author_id: 'eu', conversation_id: 'd1' }), 'eu', null)).toBe(false)
  })

  it('não conta quando o chat da mensagem é o que está aberto', () => {
    expect(shouldCountUnread(msg({ conversation_id: 'd1' }), 'eu', { kind: 'conversation', id: 'd1' })).toBe(false)
    expect(shouldCountUnread(msg({ channel_id: 'c1' }), 'eu', { kind: 'channel', id: 'c1' })).toBe(false)
  })

  it('canal e conversa com o mesmo id não se confundem', () => {
    expect(shouldCountUnread(msg({ channel_id: 'x' }), 'eu', { kind: 'conversation', id: 'x' })).toBe(true)
  })
})

describe('totalUnread', () => {
  it('soma as não lidas das conversas', () => {
    const c = (n: number) => ({ unread_count: n }) as ConversationSummary
    expect(totalUnread([c(2), c(0), c(3)])).toBe(5)
    expect(totalUnread([])).toBe(0)
  })
})

describe('badgeText / unreadLabel', () => {
  it('limita a 99+', () => {
    expect(badgeText(3)).toBe('3')
    expect(badgeText(99)).toBe('99')
    expect(badgeText(120)).toBe('99+')
  })

  it('rótulo para leitor de tela, no singular e no plural', () => {
    expect(unreadLabel(1)).toBe('1 mensagem não lida')
    expect(unreadLabel(5)).toBe('5 mensagens não lidas')
  })
})
