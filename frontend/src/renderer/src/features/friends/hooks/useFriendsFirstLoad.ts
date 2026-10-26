import { useFriendStore } from '../store/friendStore'

/** Primeira carga: o esqueleto no lugar da lista (nas releituras ficam os dados antigos). */
export function useFriendsFirstLoad(): boolean {
  return useFriendStore(
    (s) => !s.loaded && s.friends.length + s.pending.length + s.blocked.length === 0
  )
}
