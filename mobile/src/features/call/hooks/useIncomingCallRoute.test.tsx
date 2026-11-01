import { renderHook } from '@testing-library/react-native'
import { act } from 'react'
import { useAuthStore } from '../../auth/store/authStore'
import { useIncomingCallStore } from '../store/incomingCallStore'

const mockPush = jest.fn()
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }))

import { useIncomingCallRoute } from './useIncomingCallRoute'

const ana = { id: 'u1', username: 'ana', display_name: 'Ana' }

beforeEach(() => {
  jest.clearAllMocks()
  useIncomingCallStore.getState().clear()
  useAuthStore.setState({ status: 'signedIn' })
})

describe('useIncomingCallRoute', () => {
  it('chamada tocando abre a tela de atender', async () => {
    await renderHook(() => useIncomingCallRoute())
    await act(async () => useIncomingCallStore.getState().ring({ callId: 'c1', conversationId: 'cv', initiator: ana }))
    expect(mockPush).toHaveBeenCalledWith('/chamada-recebida')
  })

  it('a mesma chamada não abre a tela duas vezes', async () => {
    await renderHook(() => useIncomingCallRoute())
    await act(async () => useIncomingCallStore.getState().ring({ callId: 'c1', conversationId: 'cv', initiator: ana }))
    await act(async () => useIncomingCallStore.getState().ring({ callId: 'c1', conversationId: 'cv', initiator: { ...ana, display_name: 'Ana B.' } }))
    expect(mockPush).toHaveBeenCalledTimes(1)
  })

  it('sem sessão aberta não navega', async () => {
    useAuthStore.setState({ status: 'signedOut' })
    await renderHook(() => useIncomingCallRoute())
    await act(async () => useIncomingCallStore.getState().ring({ callId: 'c1', conversationId: 'cv', initiator: ana }))
    expect(mockPush).not.toHaveBeenCalled()
  })
})
