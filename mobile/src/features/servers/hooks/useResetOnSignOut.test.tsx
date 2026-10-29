import { act, renderHook } from '@testing-library/react-native'
import { useAuthStore } from '../../auth/store/authStore'
import { useConversationsStore } from '../../chat/store/conversationsStore'
import { useUnreadStore } from '../../chat/store/unreadStore'
import { useFriendsStore } from '../../friends/store/friendsStore'
import { usePresenceStore } from '../../friends/store/presenceStore'
import { useProfileCardStore } from '../../profile/store/profileCardStore'
import { useSelectedServerStore } from '../store/selectedServerStore'
import { useServersStore } from '../store/serversStore'
import { useResetOnSignOut } from './useResetOnSignOut'

describe('useResetOnSignOut', () => {
  it('ao sair da conta, limpa servidores, canais e a seleção (não vaza para a próxima conta)', async () => {
    useAuthStore.setState({ status: 'signedIn' })
    useServersStore.setState({ servers: [{ id: 's1', name: 'A', owner_id: 'u' }], status: 'ready' })
    useSelectedServerStore.setState({ serverId: 's1' })
    useConversationsStore.setState({ conversations: [{ id: 'd1' } as never], status: 'ready' })
    usePresenceStore.setState({ statuses: { u1: 'online' } })
    useFriendsStore.setState({ friends: [{ id: 'f', username: 'f', display_name: 'F' }] })
    useUnreadStore.getState().add('c1', 's1')
    useProfileCardStore.getState().put({ id: 'u9', username: 'z', display_name: 'Z' })
    await renderHook(() => useResetOnSignOut())
    expect(useServersStore.getState().servers).toHaveLength(1)

    await act(async () => useAuthStore.setState({ status: 'signedOut' }))
    expect(useServersStore.getState().servers).toEqual([])
    expect(useSelectedServerStore.getState().serverId).toBeNull()
    expect(useConversationsStore.getState().conversations).toEqual([])
    expect(usePresenceStore.getState().statuses).toEqual({})
    expect(useFriendsStore.getState().friends).toEqual([])
    expect(useUnreadStore.getState().byServer).toEqual({})
    expect(useProfileCardStore.getState().cards).toEqual({})
  })

  it('logado: não mexe nos dados', async () => {
    useAuthStore.setState({ status: 'signedIn' })
    useServersStore.setState({ servers: [{ id: 's1', name: 'A', owner_id: 'u' }] })
    await renderHook(() => useResetOnSignOut())
    expect(useServersStore.getState().servers).toHaveLength(1)
  })
})
