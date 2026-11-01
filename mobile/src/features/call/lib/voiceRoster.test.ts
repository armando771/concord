import { rosterFromCalls } from './voiceRoster'

describe('rosterFromCalls', () => {
  it('agrupa quem está em cada canal de voz', () => {
    const roster = rosterFromCalls([
      {
        call: { id: 'c1', type: 'channel', channel_id: 'v1', initiator_id: 'u1', status: 'active' },
        participants: [
          { user_id: 'u1', username: 'ana', display_name: 'Ana' },
          { user_id: 'u2', display_name: 'Bia' }
        ]
      },
      { call: { id: 'c2', type: 'channel', channel_id: 'v2', initiator_id: 'u3', status: 'active' }, participants: [{ user_id: 'u3', username: 'caio', display_name: 'Caio' }] }
    ])
    expect(Object.keys(roster)).toEqual(['v1', 'v2'])
    expect(roster.v1.map((p) => p.display_name)).toEqual(['Ana', 'Bia'])
  })

  it('ignora chamadas sem canal, encerradas ou vazias', () => {
    const roster = rosterFromCalls([
      { call: null, participants: [] },
      { call: { id: 'c1', type: 'dm', initiator_id: 'u1', status: 'active' }, participants: [{ user_id: 'u1' }] },
      { call: { id: 'c2', type: 'channel', channel_id: 'v1', initiator_id: 'u1', status: 'ended' }, participants: [{ user_id: 'u1' }] },
      { call: { id: 'c3', type: 'channel', channel_id: 'v3', initiator_id: 'u1', status: 'active' }, participants: [] }
    ])
    expect(roster).toEqual({})
  })
})
