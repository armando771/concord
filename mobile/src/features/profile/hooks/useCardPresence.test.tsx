import { renderHook } from '@testing-library/react-native'
import { usePresenceStore } from '../../friends/store/presenceStore'
import { useAuthStore } from '../../auth/store/authStore'
import { useCardPresence } from './useCardPresence'

jest.mock('expo-secure-store')

describe('useCardPresence', () => {
  beforeEach(() => {
    useAuthStore.setState(useAuthStore.getInitialState(), true)
    usePresenceStore.getState().reset()
  })

  it('usa o status conhecido da pessoa', async () => {
    usePresenceStore.setState({ statuses: { u2: 'idle' } })
    const { result } = await renderHook(() => useCardPresence('u2'))
    expect(result.current).toBe('idle')
  })

  it('o próprio usuário sem status conhecido está online (o app está aberto)', async () => {
    useAuthStore.setState({ user: { id: 'u1', username: 'eu', display_name: 'Eu', email: 'e@x.co' } })
    const { result } = await renderHook(() => useCardPresence('u1'))
    expect(result.current).toBe('online')
  })

  it('outra pessoa sem status conhecido: sem bolinha', async () => {
    const { result } = await renderHook(() => useCardPresence('u2'))
    expect(result.current).toBeUndefined()
  })
})
