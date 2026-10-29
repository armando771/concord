import { NO_VOICE } from '../lib/callTypes'
import { useCallSessionStore, isInCall } from './callSessionStore'
import { useIncomingCallStore } from './incomingCallStore'
import { useParticipantsStore, voiceOf } from './participantsStore'
import { useSpeakingStore } from './speakingStore'

const ana = { id: 'u1', username: 'ana', display_name: 'Ana' }

beforeEach(() => {
  useCallSessionStore.getState().reset()
  useParticipantsStore.getState().reset()
  useSpeakingStore.getState().reset()
  useIncomingCallStore.getState().clear()
})

describe('callSessionStore', () => {
  it('begin guarda a chamada e reset volta a ocioso', () => {
    useCallSessionStore.getState().begin({ callId: 'c1', kind: 'channel', phase: 'connecting', channelId: 'ch', name: 'Geral' })
    expect(useCallSessionStore.getState()).toMatchObject({ callId: 'c1', kind: 'channel', phase: 'connecting', name: 'Geral' })
    useCallSessionStore.getState().reset()
    expect(useCallSessionStore.getState()).toMatchObject({ phase: 'idle', callId: null, name: '' })
  })

  it('begin descarta o que sobrou da chamada anterior', () => {
    useCallSessionStore.getState().begin({ callId: 'c1', kind: 'channel', phase: 'active', channelId: 'ch', name: 'A' })
    useCallSessionStore.getState().begin({ callId: 'c2', kind: 'dm', phase: 'outgoing', conversationId: 'cv', name: 'Ana' })
    expect(useCallSessionStore.getState().channelId).toBeNull()
  })

  it('isInCall é falso tocando ou ocioso e verdadeiro nas demais fases', () => {
    expect(isInCall({ phase: 'idle' })).toBe(false)
    expect(isInCall({ phase: 'ringing' })).toBe(false)
    expect(isInCall({ phase: 'connecting' })).toBe(true)
    expect(isInCall({ phase: 'reconnecting' })).toBe(true)
  })
})

describe('participantsStore', () => {
  it('upsert não duplica e atualiza o nome', () => {
    const { upsert } = useParticipantsStore.getState()
    upsert(ana)
    upsert({ ...ana, display_name: 'Ana B.' })
    expect(useParticipantsStore.getState().people).toEqual([{ ...ana, display_name: 'Ana B.' }])
  })

  it('remove tira a pessoa e o estado de voz dela', () => {
    const s = useParticipantsStore.getState()
    s.upsert(ana)
    s.setVoice('u1', { ...NO_VOICE, muted: true })
    s.remove('u1')
    expect(useParticipantsStore.getState()).toMatchObject({ people: [], voice: {} })
  })

  it('voiceOf devolve sem mudo para quem não tem estado', () => {
    expect(voiceOf({}, 'x')).toEqual(NO_VOICE)
  })
})

describe('speaking e incoming', () => {
  it('guardam e limpam', () => {
    useSpeakingStore.getState().set(['u1'])
    expect(useSpeakingStore.getState().speaking).toEqual(['u1'])
    useIncomingCallStore.getState().ring({ callId: 'c1', conversationId: 'cv', initiator: ana })
    expect(useIncomingCallStore.getState().call?.callId).toBe('c1')
    useIncomingCallStore.getState().clear()
    expect(useIncomingCallStore.getState().call).toBeNull()
  })
})
