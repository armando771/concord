import { create } from 'zustand'
import * as api from '../api/friends'
import type { Friend, PendingRequest, SendRequestResult } from '../api/friends'

type Status = 'idle' | 'loading' | 'ready' | 'error'
export type ActionOutcome = 'ok' | 'error'
export type SendOutcome = { kind: 'ok'; result: SendRequestResult } | { kind: 'error'; error: unknown }

interface FriendsState {
  friends: Friend[]
  pending: PendingRequest[]
  blocked: Friend[]
  status: Status
  /** Recarrega as três listas; a que falhar mantém o que já tinha (e marca erro). */
  load: () => Promise<void>
  accept: (username: string) => Promise<ActionOutcome>
  decline: (username: string) => Promise<ActionOutcome>
  cancel: (username: string) => Promise<ActionOutcome>
  remove: (username: string) => Promise<ActionOutcome>
  block: (userId: string) => Promise<ActionOutcome>
  unblock: (userId: string) => Promise<ActionOutcome>
  send: (username: string) => Promise<SendOutcome>
  reset: () => void
}

const empty = (): Pick<FriendsState, 'friends' | 'pending' | 'blocked' | 'status'> => ({
  friends: [],
  pending: [],
  blocked: [],
  status: 'idle'
})

export const useFriendsStore = create<FriendsState>()((set, get) => {
  /** Roda a ação e recarrega; falha devolve "error" sem mexer nas listas. */
  const act = async (run: () => Promise<unknown>): Promise<ActionOutcome> => {
    try {
      await run()
    } catch {
      return 'error'
    }
    await get().load()
    return 'ok'
  }

  return {
    ...empty(),
    load: async () => {
      set({ status: 'loading' })
      const [friends, pending, blocked] = await Promise.allSettled([api.listFriends(), api.listPending(), api.listBlocked()])
      set((s) => ({
        friends: friends.status === 'fulfilled' ? friends.value : s.friends,
        pending: pending.status === 'fulfilled' ? pending.value : s.pending,
        blocked: blocked.status === 'fulfilled' ? blocked.value : s.blocked,
        status: [friends, pending, blocked].every((r) => r.status === 'fulfilled') ? 'ready' : 'error'
      }))
    },
    accept: (username) => act(() => api.acceptFriendRequest(username)),
    decline: (username) => act(() => api.declineFriendRequest(username)),
    cancel: (username) => act(() => api.cancelFriendRequest(username)),
    remove: (username) => act(() => api.removeFriend(username)),
    block: (userId) => act(() => api.blockUser(userId)),
    unblock: (userId) => act(() => api.unblockUser(userId)),
    send: async (username) => {
      try {
        const { result } = await api.sendFriendRequest(username)
        await get().load()
        return { kind: 'ok', result }
      } catch (error) {
        return { kind: 'error', error }
      }
    },
    reset: () => set(empty())
  }
})
