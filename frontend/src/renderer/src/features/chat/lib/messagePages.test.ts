import { describe, expect, it } from 'vitest'
import type { Message } from '../api/messages'
import { withMessagePage } from './messagePages'

const msg = (n: number): Message =>
  ({
    id: `m${n}`,
    content: `${n}`,
    created_at: new Date(Date.UTC(2026, 0, 1, 0, 0, n)).toISOString()
  }) as Message

const ROOM = 'channel:1'

describe('withMessagePage', () => {
  it('junta a página à lista da sala, em ordem, sem mexer nas outras salas', () => {
    const other = [msg(9)]
    const next = withMessagePage(
      { messagesByRoom: { [ROOM]: [msg(3)], 'channel:2': other }, hasMoreByRoom: {} },
      ROOM,
      [msg(1), msg(2)],
      2
    )
    expect(next.messagesByRoom[ROOM].map((m) => m.id)).toEqual(['m1', 'm2', 'm3'])
    expect(next.messagesByRoom['channel:2']).toBe(other)
  })

  it('página cheia: pode haver mais', () => {
    const next = withMessagePage({ messagesByRoom: {}, hasMoreByRoom: {} }, ROOM, [msg(1)], 1)
    expect(next.hasMoreByRoom[ROOM]).toBe(true)
  })

  it('página incompleta ou vazia: acabou o histórico', () => {
    const state = { messagesByRoom: { [ROOM]: [msg(5)] }, hasMoreByRoom: { [ROOM]: true } }
    expect(withMessagePage(state, ROOM, [msg(1)], 2).hasMoreByRoom[ROOM]).toBe(false)
    const empty = withMessagePage(state, ROOM, [], 2)
    expect(empty.hasMoreByRoom[ROOM]).toBe(false)
    expect(empty.messagesByRoom[ROOM].map((m) => m.id)).toEqual(['m5'])
  })
})
