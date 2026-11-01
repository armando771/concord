import { beforeEach, describe, expect, it, vi } from 'vitest'

// Amigos: só a primeira carga mostra o skeleton; reler não volta a ele.

const listFriends = vi.fn()
const listPending = vi.fn()
const listBlocked = vi.fn()
vi.mock('../api/friends', () => ({
  listFriends: (...a: unknown[]) => listFriends(...a),
  listPending: (...a: unknown[]) => listPending(...a),
  listBlocked: (...a: unknown[]) => listBlocked(...a),
  sendFriendRequest: vi.fn(),
  acceptFriendRequest: vi.fn(),
  declineFriendRequest: vi.fn(),
  cancelFriendRequest: vi.fn(),
  removeFriend: vi.fn(),
  blockUser: vi.fn(),
  unblockUser: vi.fn()
}))
vi.mock('../../auth/store/authStore', () => ({
  useAuthStore: { getState: () => ({ accessToken: 't' }) }
}))

const { useFriendStore } = await import('./friendStore')

beforeEach(() => {
  listFriends.mockReset()
  listPending.mockReset()
  listBlocked.mockReset()
  useFriendStore.getState().reset()
  vi.spyOn(console, 'error').mockImplementation(() => {})
})

describe('friendStore.loaded', () => {
  it('começa falso e vira verdadeiro com a primeira resposta', async () => {
    listFriends.mockResolvedValue([])
    listPending.mockResolvedValue([])
    listBlocked.mockResolvedValue([])
    expect(useFriendStore.getState().loaded).toBe(false)
    await useFriendStore.getState().loadAll()
    expect(useFriendStore.getState().loaded).toBe(true)
  })

  it('erro nas três chamadas também encerra o skeleton', async () => {
    listFriends.mockRejectedValue(new Error('x'))
    listPending.mockRejectedValue(new Error('x'))
    listBlocked.mockRejectedValue(new Error('x'))
    await useFriendStore.getState().loadAll()
    expect(useFriendStore.getState().loaded).toBe(true)
  })

  it('releitura mantém loaded e não volta ao skeleton', async () => {
    listFriends.mockResolvedValue([])
    listPending.mockResolvedValue([])
    listBlocked.mockResolvedValue([])
    await useFriendStore.getState().loadAll()
    const seen: boolean[] = []
    const stop = useFriendStore.subscribe((s) => seen.push(s.loaded))
    await useFriendStore.getState().loadAll()
    stop()
    expect(seen.every(Boolean)).toBe(true)
  })

  it('reset (sair da conta) volta à primeira carga', async () => {
    listFriends.mockResolvedValue([])
    listPending.mockResolvedValue([])
    listBlocked.mockResolvedValue([])
    await useFriendStore.getState().loadAll()
    useFriendStore.getState().reset()
    expect(useFriendStore.getState().loaded).toBe(false)
  })
})
