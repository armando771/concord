import { describe, expect, it } from 'vitest'
import { CALL_RESUME_TTL_MS, freshCallResume, validCallResume } from './callResume'

const snapshot = {
  userId: 'user',
  backendUrl: 'https://api',
  serverId: 'server',
  channelId: 'channel',
  muted: true,
  deafened: true,
  mutedBeforeDeafen: false
}

describe('call resume validation', () => {
  it('aceita somente snapshots completos', () => {
    expect(validCallResume(snapshot)).toBe(true)
    expect(validCallResume({ ...snapshot, channelId: '' })).toBe(false)
    expect(validCallResume({ ...snapshot, muted: 'true' })).toBe(false)
    expect(validCallResume(null)).toBe(false)
  })
  it('descarta registros expirados, futuros e sem horário', () => {
    const now = CALL_RESUME_TTL_MS * 2
    expect(freshCallResume({ ...snapshot, savedAt: now - 1000 }, now)).toBe(true)
    expect(freshCallResume({ ...snapshot, savedAt: now - CALL_RESUME_TTL_MS }, now)).toBe(false)
    expect(freshCallResume({ ...snapshot, savedAt: now + 1 }, now)).toBe(false)
    expect(freshCallResume(snapshot, now)).toBe(false)
  })
})
