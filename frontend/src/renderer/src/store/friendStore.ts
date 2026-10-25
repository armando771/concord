import { create } from 'zustand'
import type { PublicUser } from './authStore'
import { useAuthStore } from './authStore'
import { useChatStore } from './chatStore'
import type { PendingRequest } from '../api/friends'
import {
  listFriends,
  listPending,
  sendFriendRequest,
  acceptFriendRequest,
  declineFriendRequest,
  cancelFriendRequest,
  removeFriend
} from '../api/friends'

interface FriendState {
  friends: PublicUser[]
  pending: PendingRequest[]
  loading: boolean
  error: string | null
  fetchFriends: () => Promise<void>
  fetchPending: () => Promise<void>
  loadAll: () => Promise<void>
  sendRequest: (username: string) => Promise<void>
  accept: (username: string) => Promise<void>
  decline: (username: string) => Promise<void>
  cancel: (username: string) => Promise<void>
  remove: (username: string) => Promise<void>
  reset: () => void
}

const isSameSession = (tokenAtStart: string | null): boolean =>
  useAuthStore.getState().accessToken === tokenAtStart

const refetchOnFocus = (): void => {
  if (!useAuthStore.getState().accessToken) return
  useFriendStore.getState().loadAll()
}

if (typeof window !== 'undefined') {
  window.addEventListener('focus', refetchOnFocus)
}

export const useFriendStore = create<FriendState>()((set, get) => ({
  friends: [],
  pending: [],
  loading: false,
  error: null,
  fetchFriends: async () => {
    const token = useAuthStore.getState().accessToken
    try {
      const friends = await listFriends()
      if (!isSameSession(token)) return
      set({ friends: Array.isArray(friends) ? friends : [] })
    } catch (err) {
      console.error('[friendStore] fetchFriends error:', err)
      if (isSameSession(token)) set({ friends: [] })
    }
  },
  fetchPending: async () => {
    const token = useAuthStore.getState().accessToken
    try {
      const pending = await listPending()
      if (!isSameSession(token)) return
      set({ pending: Array.isArray(pending) ? pending : [] })
    } catch (err) {
      console.error('[friendStore] fetchPending error:', err)
      if (isSameSession(token)) set({ pending: [] })
    }
  },
  loadAll: async () => {
    const token = useAuthStore.getState().accessToken
    set({ loading: true, error: null })
    try {
      const [friends, pending] = await Promise.allSettled([listFriends(), listPending()])

      if (!isSameSession(token)) return

      const resolvedFriends =
        friends.status === 'fulfilled' && Array.isArray(friends.value) ? friends.value : []

      const resolvedPending =
        pending.status === 'fulfilled' && Array.isArray(pending.value) ? pending.value : []

      if (friends.status === 'rejected') {
        console.error('[friendStore] listFriends failed:', friends.reason)
      }
      if (pending.status === 'rejected') {
        console.error('[friendStore] listPending failed:', pending.reason)
      }

      set({ friends: resolvedFriends, pending: resolvedPending })
    } finally {
      set({ loading: false })
    }
  },
  sendRequest: async (username) => {
    await sendFriendRequest(username)
    await get().fetchPending()
  },
  accept: async (username) => {
    await acceptFriendRequest(username)
    await get().fetchPending()
    await get().fetchFriends()
  },
  decline: async (username) => {
    await declineFriendRequest(username)
    await get().fetchPending()
  },
  cancel: async (username) => {
    await cancelFriendRequest(username)
    await get().fetchPending()
  },
  remove: async (username) => {
    await removeFriend(username)
    const removed = get().friends.find((f) => f.username === username)
    if (removed) {
      useChatStore.getState().handleFriendRemoved(removed.id)
    }
    set({ friends: get().friends.filter((f) => f.username !== username) })
    await get().fetchPending()
  },
  reset: () => set({ friends: [], pending: [], loading: false, error: null })
}))
