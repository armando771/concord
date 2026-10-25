/** Dados de retomada, nunca tokens ou streams de mídia. */
export interface CallResume {
  userId: string
  backendUrl: string
  serverId: string
  channelId: string
  muted: boolean
  deafened: boolean
  mutedBeforeDeafen: boolean
}

export interface PendingCallResume extends CallResume {
  savedAt: number
}

export const CALL_RESUME_TTL_MS = 10 * 60_000

export function validCallResume(value: unknown): value is CallResume {
  if (!value || typeof value !== 'object') return false
  const s = value as Record<string, unknown>
  return (
    ['userId', 'backendUrl', 'serverId', 'channelId'].every(
      (key) => typeof s[key] === 'string' && s[key] !== ''
    ) && ['muted', 'deafened', 'mutedBeforeDeafen'].every((key) => typeof s[key] === 'boolean')
  )
}

export function freshCallResume(value: unknown, now = Date.now()): value is PendingCallResume {
  if (!validCallResume(value)) return false
  const age = now - (value as PendingCallResume).savedAt
  return Number.isFinite(age) && age >= 0 && age < CALL_RESUME_TTL_MS
}
