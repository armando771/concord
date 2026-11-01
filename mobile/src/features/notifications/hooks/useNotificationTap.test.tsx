import { renderHook } from '@testing-library/react-native'
import { act } from 'react'
import { useAuthStore } from '../../auth/store/authStore'

const mockPush = jest.fn()
jest.mock('expo-router', () => ({ useRouter: () => ({ push: mockPush }) }))

let mockTapListener: ((d: Record<string, unknown> | undefined) => void) | null = null
const mockUnsubscribe = jest.fn()
const mockTakeLaunchTap = jest.fn()
jest.mock('../lib/expoPush', () => ({
  onNotificationTap: (cb: typeof mockTapListener) => {
    mockTapListener = cb
    return mockUnsubscribe
  },
  takeLaunchTap: () => mockTakeLaunchTap()
}))

const mockHandleCallInviteTap = jest.fn().mockResolvedValue(undefined)
jest.mock('../../call/lib/callInviteTap', () => ({ handleCallInviteTap: (d: unknown) => mockHandleCallInviteTap(d) }))
jest.mock('../../call/api/calls', () => ({ getActiveDmCall: jest.fn() }))

import { useNotificationTap } from './useNotificationTap'

beforeEach(() => {
  jest.clearAllMocks()
  mockTapListener = null
  mockTakeLaunchTap.mockResolvedValue(undefined)
  useAuthStore.setState({ status: 'signedIn' })
})

describe('useNotificationTap', () => {
  it('toque numa DM abre a conversa', async () => {
    await renderHook(() => useNotificationTap())
    act(() => mockTapListener?.({ type: 'dm', conversation_id: 'c1', conversation_type: 'dm', name: 'Ana' }))
    expect(mockPush).toHaveBeenCalledWith({
      pathname: '/dm/[conversationId]',
      params: { conversationId: 'c1', name: 'Ana', type: 'dm' }
    })
  })

  it('toque que abriu o app do zero também navega', async () => {
    mockTakeLaunchTap.mockResolvedValue({ type: 'friend_request', username: 'ana' })
    await renderHook(() => useNotificationTap())
    expect(mockPush).toHaveBeenCalledWith({ pathname: '/amigos' })
  })

  it('toque na chamada recebida consulta o servidor em vez de navegar', async () => {
    await renderHook(() => useNotificationTap())
    const data = { type: 'call_invite', call_id: 'c1', conversation_id: 'cv1', name: 'Ana' }
    act(() => mockTapListener?.(data))
    expect(mockHandleCallInviteTap).toHaveBeenCalledWith(data)
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('dados desconhecidos não navegam', async () => {
    await renderHook(() => useNotificationTap())
    act(() => mockTapListener?.({ type: 'x' }))
    expect(mockPush).not.toHaveBeenCalled()
  })

  it('sem sessão aberta não ouve toques (as telas estão protegidas)', async () => {
    useAuthStore.setState({ status: 'signedOut' })
    await renderHook(() => useNotificationTap())
    expect(mockTapListener).toBeNull()
    expect(mockTakeLaunchTap).not.toHaveBeenCalled()
  })

  it('desinscreve ao desmontar', async () => {
    const { unmount } = await renderHook(() => useNotificationTap())
    await unmount()
    expect(mockUnsubscribe).toHaveBeenCalled()
  })
})
