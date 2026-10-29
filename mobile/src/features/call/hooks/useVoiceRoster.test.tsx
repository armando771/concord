import { renderHook } from '@testing-library/react-native'
import { act } from 'react'
import { useCallSessionStore } from '../store/callSessionStore'

const mockList = jest.fn()
jest.mock('../api/calls', () => ({ listServerCalls: (id: string) => mockList(id) }))
let mockReconnect: (() => void) | null = null
jest.mock('../../../shared/api/realtime', () => ({
  onRealtimeReconnect: (l: () => void) => {
    mockReconnect = l
    return jest.fn()
  }
}))

import { useVoiceRoster } from './useVoiceRoster'

const state = (channelId: string) => ({
  call: { id: 'c1', type: 'channel', channel_id: channelId, initiator_id: 'u1', status: 'active' },
  participants: [{ user_id: 'u1', username: 'ana', display_name: 'Ana' }]
})

beforeEach(() => {
  jest.clearAllMocks()
  jest.useFakeTimers()
  useCallSessionStore.getState().reset()
  mockList.mockResolvedValue([state('v1')])
})
afterEach(() => jest.useRealTimers())

describe('useVoiceRoster', () => {
  it('carrega quem está nos canais de voz do servidor', async () => {
    const { result } = await renderHook(() => useVoiceRoster('s1'))
    await act(async () => {})
    expect(mockList).toHaveBeenCalledWith('s1')
    expect(result.current.v1[0].display_name).toBe('Ana')
  })

  it('sem servidor selecionado não consulta e devolve vazio', async () => {
    const { result } = await renderHook(() => useVoiceRoster(null))
    expect(mockList).not.toHaveBeenCalled()
    expect(result.current).toEqual({})
  })

  it('atualiza a cada 20 s, ao reconectar e quando a minha chamada muda', async () => {
    await renderHook(() => useVoiceRoster('s1'))
    await act(async () => {})
    await act(async () => {
      jest.advanceTimersByTime(20_000)
    })
    expect(mockList).toHaveBeenCalledTimes(2)
    await act(async () => mockReconnect?.())
    expect(mockList).toHaveBeenCalledTimes(3)
    await act(async () => useCallSessionStore.getState().begin({ callId: 'c9', kind: 'channel', phase: 'connecting', name: 'Geral' }))
    expect(mockList).toHaveBeenCalledTimes(4)
  })

  it('erro de rede mantém a lista anterior', async () => {
    const { result } = await renderHook(() => useVoiceRoster('s1'))
    await act(async () => {})
    mockList.mockRejectedValue(new Error('rede'))
    await act(async () => {
      jest.advanceTimersByTime(20_000)
    })
    expect(result.current.v1).toHaveLength(1)
  })
})
