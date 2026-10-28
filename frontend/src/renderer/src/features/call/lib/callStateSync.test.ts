import { describe, expect, it } from 'vitest'
import type { CallStateResponse } from '../api/calls'
import { syncCallState, type LocalCallState } from './callStateSync'

const user = (
  id: string
): { id: string; username: string; display_name: string; avatar_url: null } => ({
  id,
  username: id,
  display_name: id,
  avatar_url: null
})

const local = (over: Partial<LocalCallState> = {}): LocalCallState => ({
  type: 'channel',
  locked: false,
  participants: [],
  joinRequests: [],
  voiceStates: {},
  screenWatchers: {},
  ...over
})

const server = (over: Partial<CallStateResponse> = {}): CallStateResponse => ({
  call: null,
  participants: [
    { call_id: 'c', user_id: 'eu', role: 'member', joined_at: '' },
    {
      call_id: 'c',
      user_id: 'ana',
      role: 'member',
      joined_at: '',
      username: 'ana',
      muted: true
    }
  ],
  ...over
})

describe('syncCallState', () => {
  it('lista os outros participantes, sem mim, com nome de reserva', () => {
    const synced = syncCallState(server(), 'eu', local(), true)
    expect(synced.participants).toEqual([
      { id: 'ana', username: 'ana', display_name: 'ana', avatar_url: null, name_style: undefined }
    ])
    expect(synced.voiceStates.ana).toEqual({
      muted: true,
      deafened: false,
      serverMuted: false,
      serverDeafened: false
    })
  })

  it('sem replace, só soma quem faltava e mantém o mudo que já chegou por evento', () => {
    const bia = user('bia')
    const synced = syncCallState(
      server({ join_requests: [user('caio')] }),
      'eu',
      local({
        participants: [bia],
        joinRequests: [user('caio')],
        voiceStates: { ana: { muted: false, deafened: true } }
      }),
      false
    )
    expect(synced.participants.map((p) => p.id)).toEqual(['bia', 'ana'])
    expect(synced.joinRequests.map((p) => p.id)).toEqual(['caio'])
    expect(synced.voiceStates.ana).toEqual({ muted: false, deafened: true })
  })

  it('com replace, o servidor vale no canal; na DM a lista não encolhe', () => {
    const bia = user('bia')
    expect(
      syncCallState(server(), 'eu', local({ participants: [bia] }), true).participants.map(
        (p) => p.id
      )
    ).toEqual(['ana'])
    expect(
      syncCallState(
        server(),
        'eu',
        local({ type: 'dm', participants: [bia] }),
        true
      ).participants.map((p) => p.id)
    ).toEqual(['bia', 'ana'])
  })

  it('trava, telas e espectadores vêm do servidor, com o local de reserva', () => {
    const watchers = { ana: [user('bia')] }
    const synced = syncCallState(
      server({ screen_sharing: ['ana'], screen_watchers: watchers }),
      'eu',
      local({ locked: true }),
      true
    )
    expect(synced).toMatchObject({ locked: true, screenSharers: ['ana'], screenWatchers: watchers })
    expect(syncCallState(server(), 'eu', local({ screenWatchers: watchers }), true)).toMatchObject({
      screenSharers: [],
      screenWatchers: watchers
    })
  })
})
