import { renderHook } from '@testing-library/react-native'
import { act } from 'react'
import { useAuthStore } from '../../auth/store/authStore'

const mockStart = jest.fn().mockResolvedValue(undefined)
const mockStop = jest.fn()
jest.mock('../lib/pushSession', () => ({ pushRegistration: { start: () => mockStart(), stop: () => mockStop(), forget: jest.fn() } }))
const mockSilence = jest.fn()
jest.mock('../lib/expoPush', () => ({ silenceForeground: () => mockSilence() }))

import { usePushRegistration } from './usePushRegistration'

beforeEach(() => {
  jest.clearAllMocks()
  useAuthStore.setState({ status: 'loading' })
})

describe('usePushRegistration', () => {
  it('silencia o banner em primeiro plano ao montar', async () => {
    await renderHook(() => usePushRegistration())
    expect(mockSilence).toHaveBeenCalled()
  })

  it('só registra o aparelho com a sessão aberta', async () => {
    await renderHook(() => usePushRegistration())
    expect(mockStart).not.toHaveBeenCalled()
    await act(async () => useAuthStore.setState({ status: 'signedIn' }))
    expect(mockStart).toHaveBeenCalledTimes(1)
  })

  it('ao sair da conta para de ouvir o token', async () => {
    useAuthStore.setState({ status: 'signedIn' })
    const { unmount } = await renderHook(() => usePushRegistration())
    await unmount()
    expect(mockStop).toHaveBeenCalled()
  })
})
