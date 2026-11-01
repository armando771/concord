import { renderHook } from '@testing-library/react-native'
import { act } from 'react'
import { useAuthStore } from '../../auth/store/authStore'
import { useVoiceControlsStore } from '../../voice/store/voiceControlsStore'
import { useCallSessionStore } from '../store/callSessionStore'
import { useParticipantsStore } from '../store/participantsStore'

jest.mock('../lib/callRuntime', () => ({
  callController: {
    connectIfNeeded: jest.fn().mockResolvedValue(undefined),
    followMove: jest.fn().mockResolvedValue(undefined),
    applyAudio: jest.fn().mockResolvedValue(undefined),
    leave: jest.fn().mockResolvedValue(undefined)
  }
}))
const mockController = (jest.requireMock('../lib/callRuntime') as { callController: Record<string, jest.Mock> }).callController

import { useCallLifecycle } from './useCallLifecycle'

beforeEach(() => {
  jest.clearAllMocks()
  useCallSessionStore.getState().reset()
  useParticipantsStore.getState().reset()
  useVoiceControlsStore.setState({ muted: false, deafened: false, mutedBeforeDeafen: false })
  useAuthStore.setState({ status: 'signedIn', user: { id: 'me', username: 'eu', display_name: 'Eu', email: 'e@e.co' } })
})

describe('useCallLifecycle', () => {
  it('fase connecting com chamada: conecta a mídia', async () => {
    await renderHook(() => useCallLifecycle())
    await act(async () => useCallSessionStore.getState().begin({ callId: 'c1', kind: 'dm', phase: 'connecting', name: 'Ana' }))
    expect(mockController.connectIfNeeded).toHaveBeenCalled()
  })

  it('mudo ou fone mudou: reaplica o áudio', async () => {
    await renderHook(() => useCallLifecycle())
    await act(async () => useVoiceControlsStore.setState({ muted: true }))
    expect(mockController.applyAudio).toHaveBeenCalled()
  })

  it('moderador me silenciou: reaplica o áudio', async () => {
    await renderHook(() => useCallLifecycle())
    await act(async () =>
      useParticipantsStore.getState().setVoice('me', { muted: false, deafened: false, serverMuted: true, serverDeafened: false })
    )
    expect(mockController.applyAudio).toHaveBeenCalled()
  })

  it('movido por moderador: segue para o canal novo', async () => {
    await renderHook(() => useCallLifecycle())
    await act(async () => useCallSessionStore.getState().setMovedTo({ channelId: 'ch2', name: 'Jogos' }))
    expect(mockController.followMove).toHaveBeenCalled()
  })

  it('sair da conta desconecta a chamada sem avisar o servidor', async () => {
    await renderHook(() => useCallLifecycle())
    await act(async () => useAuthStore.setState({ status: 'signedOut' }))
    expect(mockController.leave).toHaveBeenCalledWith(false)
  })
})
