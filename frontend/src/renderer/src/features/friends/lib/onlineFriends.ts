import type { PublicUser } from '../../auth/store/authStore'

/** Amigos com presença conhecida e status diferente de offline (sem status = online). */
export function onlineFriends(
  friends: PublicUser[],
  presence: Record<string, unknown>,
  statuses: Record<string, string | undefined>
): PublicUser[] {
  return friends.filter((f) => presence[f.id] && (statuses[f.id] ?? 'online') !== 'offline')
}

interface CallLike {
  participants?: { user_id: string }[]
}

/** Amigos que estão em algum canal de voz de servidor. */
export function friendsInVoice(
  friends: PublicUser[],
  serverCalls: Record<string, CallLike>
): PublicUser[] {
  const ids = new Set<string>()
  for (const state of Object.values(serverCalls)) {
    for (const p of state.participants ?? []) ids.add(p.user_id)
  }
  return friends.filter((f) => ids.has(f.id))
}
