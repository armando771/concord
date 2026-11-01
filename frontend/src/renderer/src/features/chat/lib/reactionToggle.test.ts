import { describe, expect, it } from 'vitest'
import type { Message } from '../api/messages'
import { withReaction } from './reactionToggle'

const msg = (id: string, reactions: Message['reactions'] = []): Message => ({
  id,
  author_id: 'bia',
  content: 'oi',
  created_at: '2026-01-01T10:00:00Z',
  reactions
})

describe('withReaction', () => {
  it('põe a reação só na mensagem certa da sala', () => {
    const byRoom = { 'channel:a': [msg('m1'), msg('m2')], 'channel:b': [msg('m1')] }
    const next = withReaction(byRoom, 'channel:a', 'm1', '👍', 'ana', true)
    expect(next['channel:a'][0].reactions).toEqual([{ emoji: '👍', count: 1, user_ids: ['ana'] }])
    expect(next['channel:a'][1]).toBe(byRoom['channel:a'][1])
    expect(next['channel:b']).toBe(byRoom['channel:b'])
  })

  it('tira a reação (a última some do chip)', () => {
    const byRoom = { r: [msg('m1', [{ emoji: '👍', count: 1, user_ids: ['ana'] }])] }
    expect(withReaction(byRoom, 'r', 'm1', '👍', 'ana', false).r[0].reactions).toEqual([])
  })

  it('sala que não está aberta fica vazia, sem quebrar', () => {
    expect(withReaction({}, 'r', 'm1', '👍', 'ana', true).r).toEqual([])
  })
})
