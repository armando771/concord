import { describe, expect, it } from 'vitest'
import { guestIdsOf } from './guestRoster'
import type { CallParticipant } from '../../call/api/calls'

const p = (user_id: string, guest_of?: string): CallParticipant => ({
  call_id: 'c',
  user_id,
  role: 'member',
  joined_at: '',
  guest_of
})

describe('visitantes da call', () => {
  it('só quem é visitante do servidor desta call', () => {
    const call = { id: 'c', type: 'channel', server_id: 'srv' } as never
    expect(guestIdsOf({ call, participants: [p('a'), p('b', 'srv'), p('c', 'outro')] })).toEqual([
      'b'
    ])
  })

  it('DM não tem visitante', () => {
    expect(guestIdsOf({ call: null, participants: [p('b', 'srv')] })).toEqual([])
  })
})
