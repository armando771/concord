import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { TYPING_TTL_MS } from '../lib/typing'
import { useAuthStore } from '../../auth/store/authStore'
import { useTypingStore } from './typingStore'

const ROOM = 'channel:c1'

const typing = (user_id: string, display_name = '', username = user_id): void =>
  useTypingStore.getState().handleWsEvent({
    type: 'typing',
    payload: { room: ROOM, user_id, display_name, username }
  })

const names = (): string[] => (useTypingStore.getState().byRoom[ROOM] ?? []).map((t) => t.name)

describe('typingStore', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    useTypingStore.getState().reset()
    useAuthStore.setState({ user: { id: 'eu' } as never })
  })
  afterEach(() => vi.useRealTimers())

  it('some 5 s depois do último evento', () => {
    typing('ana', 'Ana')
    vi.advanceTimersByTime(3000)
    typing('ana', 'Ana')
    vi.advanceTimersByTime(TYPING_TTL_MS - 1)
    expect(names()).toEqual(['Ana'])
    vi.advanceTimersByTime(1)
    expect(names()).toEqual([])
  })

  it('sem nome de exibição usa o username; eu mesmo nunca entro', () => {
    typing('bia', '', 'bia_user')
    typing('eu', 'Eu')
    expect(names()).toEqual(['bia_user'])
  })

  it('stop e mensagem da pessoa tiram na hora', () => {
    typing('ana', 'Ana')
    typing('bia', 'Bia')
    useTypingStore.getState().handleWsEvent({
      type: 'typing:stop',
      payload: { room: ROOM, user_id: 'ana' }
    })
    expect(names()).toEqual(['Bia'])
    useTypingStore.getState().messageArrived(ROOM, 'bia')
    expect(names()).toEqual([])
  })

  it('reset (reconexão) limpa tudo e cancela o timer', () => {
    typing('ana', 'Ana')
    useTypingStore.getState().reset()
    expect(useTypingStore.getState().byRoom).toEqual({})
    expect(vi.getTimerCount()).toBe(0)
  })
})
