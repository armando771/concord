import { act, renderHook } from '@testing-library/react-native'
import type { WsEvent } from '../../../shared/api/ws'
import { useFriendsStore } from '../store/friendsStore'
import { useFriendsLive } from './useFriendsLive'

let wsHandler: (event: WsEvent) => void = () => {}
let reconnect: () => void = () => {}
jest.mock('../../../shared/api/ws', () => ({
  onWsEvent: jest.fn((l: (e: WsEvent) => void) => ((wsHandler = l), () => {}))
}))
jest.mock('../../../shared/api/realtime', () => ({
  onRealtimeReconnect: jest.fn((l: () => void) => ((reconnect = l), () => {}))
}))

describe('useFriendsLive', () => {
  const load = jest.fn()

  beforeEach(() => {
    load.mockReset().mockResolvedValue(undefined)
    useFriendsStore.setState({ ...useFriendsStore.getInitialState(), load })
  })

  it('carrega ao abrir', async () => {
    await renderHook(() => useFriendsLive())
    expect(load).toHaveBeenCalledTimes(1)
  })

  it.each(['friend:request', 'friend:request:accepted', 'friend:request:declined', 'friend:removed', 'relationship:blocked'])(
    'evento %s recarrega as listas',
    async (type) => {
      await renderHook(() => useFriendsLive())
      load.mockClear()
      await act(async () => wsHandler({ type, payload: {} }))
      expect(load).toHaveBeenCalledTimes(1)
    }
  )

  it('outros eventos não recarregam', async () => {
    await renderHook(() => useFriendsLive())
    load.mockClear()
    await act(async () => wsHandler({ type: 'message:create', payload: {} }))
    await act(async () => wsHandler({ type: 'presence:update', payload: {} }))
    expect(load).not.toHaveBeenCalled()
  })

  it('ao reconectar, recarrega (cobre pedidos perdidos)', async () => {
    await renderHook(() => useFriendsLive())
    load.mockClear()
    await act(async () => reconnect())
    expect(load).toHaveBeenCalledTimes(1)
  })
})
