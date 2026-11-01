import { describe, expect, it } from 'vitest'
import type { PublicUser } from '../../auth/store/authStore'
import { friendsInVoice, onlineFriends } from './onlineFriends'

const u = (id: string): PublicUser => ({ id, username: id }) as PublicUser
const [a, b, c] = [u('a'), u('b'), u('c')]

describe('onlineFriends', () => {
  it('exige presença e ignora quem está offline', () => {
    const presence = { a: true, b: true }
    const statuses = { b: 'offline' }
    expect(onlineFriends([a, b, c], presence, statuses)).toEqual([a])
  })
  it('status ausente conta como online', () => {
    expect(onlineFriends([a], { a: true }, {})).toEqual([a])
  })
})

describe('friendsInVoice', () => {
  it('junta os participantes de todos os canais', () => {
    const calls = {
      s1: { participants: [{ user_id: 'a' }] },
      s2: { participants: [{ user_id: 'c' }] },
      s3: {}
    }
    expect(friendsInVoice([a, b, c], calls)).toEqual([a, c])
  })
  it('sem chamadas, ninguém', () => {
    expect(friendsInVoice([a], {})).toEqual([])
  })
})
