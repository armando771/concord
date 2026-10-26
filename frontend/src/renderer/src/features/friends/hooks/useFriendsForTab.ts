import { useChatStore } from '../../chat/store/chatStore'
import { useFriendStore } from '../store/friendStore'
import { onlineFriends } from '../lib/onlineFriends'
import type { PublicUser } from '../../auth/store/authStore'

/** Amigos da aba: só os online, ou todos. */
export function useFriendsForTab(kind: 'online' | 'all'): PublicUser[] {
  const friends = useFriendStore((s) => s.friends)
  const presence = useChatStore((s) => s.presence)
  const statuses = useChatStore((s) => s.statuses)
  return kind === 'online' ? onlineFriends(friends, presence, statuses) : friends
}
