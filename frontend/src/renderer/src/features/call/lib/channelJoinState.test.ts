import { describe, expect, it } from 'vitest'
import type { CallResume } from '../../../../../shared/callResume'
import { channelJoinState } from './channelJoinState'

const resume = (over: Partial<CallResume> = {}): CallResume => ({
  userId: 'eu',
  backendUrl: 'http://x',
  serverId: 's',
  channelId: 'c',
  muted: false,
  deafened: false,
  mutedBeforeDeafen: false,
  ...over
})

describe('channelJoinState', () => {
  it('entrada nova: microfone aberto, servidor e trava da call', () => {
    expect(channelJoinState({ server_id: 's1', locked: true })).toEqual({
      muted: false,
      deafened: false,
      mutedBeforeDeafen: false,
      serverId: 's1',
      locked: true
    })
  })

  it('sem servidor nem trava na resposta: null e destrancada', () => {
    const state = channelJoinState({})
    expect(state.serverId).toBeNull()
    expect(state.locked).toBe(false)
  })

  it('retomada: volta mudo, e ensurdecido conta como mudo', () => {
    expect(channelJoinState({}, resume({ muted: true })).muted).toBe(true)
    const deaf = channelJoinState({}, resume({ deafened: true, mutedBeforeDeafen: true }))
    expect(deaf).toMatchObject({ muted: true, deafened: true, mutedBeforeDeafen: true })
    expect(channelJoinState({}, resume()).muted).toBe(false)
  })
})
