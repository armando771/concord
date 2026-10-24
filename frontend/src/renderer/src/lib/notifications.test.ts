import { describe, expect, it } from 'vitest'
import { callNotification, mentionNotification, messageNotification } from './notifications'
import type { Message } from '../api/messages'

const dm = (over: Partial<Message> = {}): Message => ({
  id: 'm1',
  author_id: 'ana',
  author: { id: 'ana', username: 'ana', display_name: 'Ana' } as Message['author'],
  conversation_id: 'c1',
  content: 'bora jogar?',
  created_at: '',
  ...over
})

describe('messageNotification', () => {
  it('DM de outra pessoa vira notificação que abre a conversa', () => {
    expect(messageNotification(dm(), 'eu')).toEqual({
      title: 'Ana',
      body: 'bora jogar?',
      route: '/dm/ana'
    })
  })

  it('não notifica as próprias mensagens', () => {
    expect(messageNotification(dm({ author_id: 'eu' }), 'eu')).toBeNull()
  })

  it('não notifica mensagens de canal de servidor', () => {
    expect(messageNotification(dm({ conversation_id: null, channel_id: 'ch1' }), 'eu')).toBeNull()
  })

  it('encurta mensagens longas', () => {
    const body = messageNotification(dm({ content: 'a'.repeat(300) }), 'eu')?.body ?? ''
    expect(body.length).toBeLessThanOrEqual(140)
    expect(body.endsWith('…')).toBe(true)
  })
})

describe('callNotification', () => {
  it('chamada recebida abre a DM de quem ligou', () => {
    expect(callNotification({ id: 'ana', display_name: 'Ana', username: 'ana' })).toEqual({
      title: 'Ana está te ligando',
      body: 'Chamada de voz — clique para atender',
      route: '/dm/ana',
      urgent: true
    })
  })
})

describe('mentionNotification', () => {
  const me = { id: 'eu', username: 'fulano' }
  const inChannel = (over: Partial<Message> = {}): Message =>
    dm({ conversation_id: null, channel_id: 'ch1', content: 'bora @fulano?', ...over })

  it('menção em canal vira notificação que abre o canal', () => {
    expect(mentionNotification(inChannel(), me, 'srv1')).toEqual({
      title: 'Ana mencionou você',
      body: 'bora @fulano?',
      route: '/servers/srv1/channels/ch1'
    })
  })

  it('sem menção, ou mensagem minha, não notifica', () => {
    expect(mentionNotification(inChannel({ content: 'bora jogar?' }), me, 'srv1')).toBeNull()
    expect(mentionNotification(inChannel({ author_id: 'eu' }), me, 'srv1')).toBeNull()
  })

  it('DM já tem a própria notificação', () => {
    expect(mentionNotification(dm({ content: '@fulano oi' }), me, null)).toBeNull()
  })
})
