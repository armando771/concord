import { onRealtimeOpen, onRealtimeReconnect } from './realtime'

// O WsClient avisa onOpen(reconnected); o realtime repassa só as reconexões aos ouvintes.
jest.mock('./ws', () => {
  let onOpen: (reconnected: boolean) => void = () => {}
  return {
    WsClient: jest.fn().mockImplementation((config: { onOpen: (r: boolean) => void }) => {
      onOpen = config.onOpen
      return {}
    }),
    __open: (reconnected: boolean) => onOpen(reconnected)
  }
})

const { __open } = jest.requireMock('./ws') as { __open: (r: boolean) => void }

describe('onRealtimeReconnect', () => {
  it('avisa só nas reconexões, não na primeira abertura', () => {
    const listener = jest.fn()
    const off = onRealtimeReconnect(listener)
    __open(false)
    expect(listener).not.toHaveBeenCalled()
    __open(true)
    expect(listener).toHaveBeenCalledTimes(1)
    off()
    __open(true)
    expect(listener).toHaveBeenCalledTimes(1)
  })
})

describe('onRealtimeOpen', () => {
  it('avisa em toda abertura, inclusive a primeira', () => {
    const listener = jest.fn()
    const off = onRealtimeOpen(listener)
    __open(false)
    __open(true)
    expect(listener).toHaveBeenCalledTimes(2)
    off()
    __open(false)
    expect(listener).toHaveBeenCalledTimes(2)
  })
})
