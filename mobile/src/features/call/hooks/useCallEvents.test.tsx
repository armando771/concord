import { renderHook } from '@testing-library/react-native'
import { act } from 'react'
import { useAuthStore } from '../../auth/store/authStore'
import { useCallSessionStore } from '../store/callSessionStore'
import { useParticipantsStore } from '../store/participantsStore'

let mockWsListener: ((e: { type: string; payload: unknown }) => void) | null = null
let mockReconnect: (() => void) | null = null
const mockOffWs = jest.fn()
jest.mock('../../../shared/api/ws', () => ({
  onWsEvent: (l: typeof mockWsListener) => {
    mockWsListener = l
    return mockOffWs
  }
}))
jest.mock('../../../shared/api/realtime', () => ({
  onRealtimeReconnect: (l: () => void) => {
    mockReconnect = l
    return jest.fn()
  }
}))
const mockGetState = jest.fn()
jest.mock('../api/calls', () => ({ getCallState: (id: string) => mockGetState(id) }))

import { useCallEvents } from './useCallEvents'

const ana = { id: 'u1', username: 'ana', display_name: 'Ana' }

beforeEach(() => {
  jest.clearAllMocks()
  mockWsListener = null
  mockReconnect = null
  useCallSessionStore.getState().reset()
  useParticipantsStore.getState().reset()
  useAuthStore.setState({ status: 'signedIn', user: { id: 'me', username: 'eu', display_name: 'Eu', email: 'e@e.co' } })
})

describe('useCallEvents', () => {
  it('repassa os eventos call:* para as stores', async () => {
    useCallSessionStore.getState().begin({ callId: 'c1', kind: 'channel', phase: 'active', name: 'Geral' })
    await renderHook(() => useCallEvents())
    act(() => mockWsListener?.({ type: 'call:joined', payload: { call_id: 'c1', user: ana } }))
    expect(useParticipantsStore.getState().people).toEqual([ana])
  })

  it('sem sessão aberta não escuta', async () => {
    useAuthStore.setState({ status: 'signedOut' })
    await renderHook(() => useCallEvents())
    expect(mockWsListener).toBeNull()
  })

  it('ao reconectar o WS refaz a lista pela API', async () => {
    useCallSessionStore.getState().begin({ callId: 'c1', kind: 'channel', phase: 'active', name: 'Geral' })
    mockGetState.mockResolvedValue({
      call: { id: 'c1', type: 'channel', initiator_id: 'u1', status: 'active' },
      participants: [{ user_id: 'u1', username: 'ana', display_name: 'Ana' }]
    })
    await renderHook(() => useCallEvents())
    await act(async () => mockReconnect?.())
    expect(mockGetState).toHaveBeenCalledWith('c1')
    expect(useParticipantsStore.getState().people).toHaveLength(1)
  })

  it('chamada que acabou durante a queda fecha a sessão', async () => {
    useCallSessionStore.getState().begin({ callId: 'c1', kind: 'channel', phase: 'active', name: 'Geral' })
    mockGetState.mockResolvedValue({ call: null, participants: [] })
    await renderHook(() => useCallEvents())
    await act(async () => mockReconnect?.())
    expect(useCallSessionStore.getState().phase).toBe('idle')
  })

  it('desinscreve ao desmontar', async () => {
    const { unmount } = await renderHook(() => useCallEvents())
    await unmount()
    expect(mockOffWs).toHaveBeenCalled()
  })
})
