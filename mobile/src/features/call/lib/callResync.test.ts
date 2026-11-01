import { resyncCall, stateToPeople } from './callResync'
import { useCallSessionStore } from '../store/callSessionStore'
import { useParticipantsStore } from '../store/participantsStore'

const state = {
  call: { id: 'c1', type: 'channel' as const, initiator_id: 'u1', status: 'active' as const },
  participants: [
    { user_id: 'u1', username: 'ana', display_name: 'Ana', muted: true, server_muted: true },
    { user_id: 'me', username: 'eu', display_name: 'Eu' },
    { user_id: 'u3', display_name: 'Caio', deafened: true }
  ]
}

beforeEach(() => {
  useCallSessionStore.getState().reset()
  useParticipantsStore.getState().reset()
})

describe('stateToPeople', () => {
  it('lista os outros participantes com o estado de voz de cada um', () => {
    const { people, voice } = stateToPeople(state, 'me')
    expect(people.map((p) => p.id)).toEqual(['u1', 'u3'])
    expect(voice.u1).toEqual({ muted: true, deafened: false, serverMuted: true, serverDeafened: false })
    expect(voice.u3).toMatchObject({ deafened: true })
  })

  it('quem vem sem nome ganha um nome padrão', () => {
    const { people } = stateToPeople({ ...state, participants: [{ user_id: 'x' }] }, 'me')
    expect(people[0]).toMatchObject({ id: 'x', display_name: 'Usuário', username: '' })
  })
})

describe('resyncCall', () => {
  it('reconstrói os participantes da chamada atual', async () => {
    useCallSessionStore.getState().begin({ callId: 'c1', kind: 'channel', phase: 'active', name: 'Geral' })
    await resyncCall({ getState: jest.fn().mockResolvedValue(state), meId: 'me', onEnded: jest.fn() })
    expect(useParticipantsStore.getState().people).toHaveLength(2)
  })

  it('chamada que acabou durante a queda encerra a sessão', async () => {
    useCallSessionStore.getState().begin({ callId: 'c1', kind: 'channel', phase: 'active', name: 'Geral' })
    const onEnded = jest.fn()
    await resyncCall({ getState: jest.fn().mockResolvedValue({ call: null, participants: [] }), meId: 'me', onEnded })
    expect(onEnded).toHaveBeenCalled()
  })

  it('erro de rede mantém o que já estava', async () => {
    useCallSessionStore.getState().begin({ callId: 'c1', kind: 'channel', phase: 'active', name: 'Geral' })
    const onEnded = jest.fn()
    await resyncCall({ getState: jest.fn().mockRejectedValue(new Error('rede')), meId: 'me', onEnded })
    expect(onEnded).not.toHaveBeenCalled()
  })

  it('sem chamada não consulta nada', async () => {
    const getState = jest.fn()
    await resyncCall({ getState, meId: 'me', onEnded: jest.fn() })
    expect(getState).not.toHaveBeenCalled()
  })
})
