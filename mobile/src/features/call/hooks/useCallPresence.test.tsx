import { renderHook } from '@testing-library/react-native'
import { act } from 'react'
import { useAuthStore } from '../../auth/store/authStore'
import { useCallSessionStore } from '../store/callSessionStore'

let mockOpen: (() => void) | null = null
const mockSend = jest.fn()
let mockConnected = true
jest.mock('../../../shared/api/realtime', () => ({
  onRealtimeOpen: (l: () => void) => {
    mockOpen = l
    return jest.fn()
  },
  realtime: { isConnected: () => mockConnected, sendEvent: (t: string, p: unknown) => mockSend(t, p) }
}))

import { useCallPresence } from './useCallPresence'

beforeEach(() => {
  jest.clearAllMocks()
  mockOpen = null
  mockConnected = true
  useCallSessionStore.getState().reset()
  useAuthStore.setState({ status: 'signedIn' })
})

describe('useCallPresence', () => {
  it('já conectado e sem chamada: avisa que não estou em nenhuma', async () => {
    await renderHook(() => useCallPresence())
    expect(mockSend).toHaveBeenCalledWith('call:presence', { call_id: null })
  })

  it('a cada abertura do WS reenvia a presença', async () => {
    mockConnected = false
    await renderHook(() => useCallPresence())
    expect(mockSend).not.toHaveBeenCalled()
    mockConnected = true
    act(() => mockOpen?.())
    expect(mockSend).toHaveBeenCalledTimes(1)
  })

  it('ao entrar numa chamada anuncia o id dela', async () => {
    await renderHook(() => useCallPresence())
    await act(async () => useCallSessionStore.getState().begin({ callId: 'c1', kind: 'channel', phase: 'connecting', name: 'Geral' }))
    expect(mockSend).toHaveBeenLastCalledWith('call:presence', { call_id: 'c1' })
  })

  it('sem sessão aberta não manda nada', async () => {
    useAuthStore.setState({ status: 'signedOut' })
    await renderHook(() => useCallPresence())
    expect(mockSend).not.toHaveBeenCalled()
  })
})
