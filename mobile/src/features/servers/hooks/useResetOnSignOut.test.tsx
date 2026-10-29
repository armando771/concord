import { act, renderHook } from '@testing-library/react-native'
import { useAuthStore } from '../../auth/store/authStore'
import { useSelectedServerStore } from '../store/selectedServerStore'
import { useServersStore } from '../store/serversStore'
import { useResetOnSignOut } from './useResetOnSignOut'

describe('useResetOnSignOut', () => {
  it('ao sair da conta, limpa servidores, canais e a seleção (não vaza para a próxima conta)', async () => {
    useAuthStore.setState({ status: 'signedIn' })
    useServersStore.setState({ servers: [{ id: 's1', name: 'A', owner_id: 'u' }], status: 'ready' })
    useSelectedServerStore.setState({ serverId: 's1' })
    await renderHook(() => useResetOnSignOut())
    expect(useServersStore.getState().servers).toHaveLength(1)

    await act(async () => useAuthStore.setState({ status: 'signedOut' }))
    expect(useServersStore.getState().servers).toEqual([])
    expect(useSelectedServerStore.getState().serverId).toBeNull()
  })

  it('logado: não mexe nos dados', async () => {
    useAuthStore.setState({ status: 'signedIn' })
    useServersStore.setState({ servers: [{ id: 's1', name: 'A', owner_id: 'u' }] })
    await renderHook(() => useResetOnSignOut())
    expect(useServersStore.getState().servers).toHaveLength(1)
  })
})
