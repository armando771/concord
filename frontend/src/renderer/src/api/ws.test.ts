import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { WsClient } from './ws'

/** WebSocket de mentira: o teste abre e fecha à mão. */
class FakeSocket {
  static CONNECTING = 0
  static OPEN = 1
  static instances: FakeSocket[] = []
  readyState = FakeSocket.CONNECTING
  onopen: (() => void) | null = null
  onclose: ((ev: { code: number }) => void) | null = null
  onmessage: ((ev: { data: string }) => void) | null = null
  onerror: (() => void) | null = null
  sent: string[] = []
  constructor(public url: string) {
    FakeSocket.instances.push(this)
  }
  send(raw: string): void {
    this.sent.push(raw)
  }
  close(): void {
    this.readyState = 3
  }
  open(): void {
    this.readyState = FakeSocket.OPEN
    this.onopen?.()
  }
  drop(code: number): void {
    this.readyState = 3
    this.onclose?.({ code })
  }
}

const latest = (): FakeSocket => FakeSocket.instances[FakeSocket.instances.length - 1]

describe('WsClient — reconexão', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    FakeSocket.instances = []
    vi.stubGlobal('WebSocket', FakeSocket)
  })
  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  const client = (): {
    ws: WsClient
    onOpen: ReturnType<typeof vi.fn>
    onLost: ReturnType<typeof vi.fn>
  } => {
    const onOpen = vi.fn()
    const onLost = vi.fn()
    const ws = new WsClient({
      getToken: () => 'tok',
      getUserId: () => 'eu',
      onEvent: () => {},
      onOpen,
      onLost
    })
    return { ws, onOpen, onLost }
  }

  it('servidor reiniciando (1012): reconecta em até 300 ms', () => {
    const { ws, onLost } = client()
    ws.connect()
    latest().open()

    latest().drop(1012)
    expect(onLost).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(300)

    expect(FakeSocket.instances).toHaveLength(2)
  })

  it('queda comum: espera o backoff normal de 1 s', () => {
    const { ws } = client()
    ws.connect()
    latest().open()

    latest().drop(1006)
    vi.advanceTimersByTime(999)
    expect(FakeSocket.instances).toHaveLength(1)
    vi.advanceTimersByTime(1)
    expect(FakeSocket.instances).toHaveLength(2)
  })

  it('avisa se é reconexão (para buscar o que se perdeu) e reassina as salas', () => {
    const { ws, onOpen } = client()
    ws.connect()
    latest().open()
    ws.subscribe('channel:1')
    expect(onOpen).toHaveBeenLastCalledWith(false)

    latest().drop(1012)
    vi.advanceTimersByTime(300)
    latest().open()

    expect(onOpen).toHaveBeenLastCalledWith(true)
    expect(latest().sent.map((raw) => JSON.parse(raw).payload.room)).toEqual(
      expect.arrayContaining(['user:eu', 'channel:1'])
    )
  })

  it('disconnect() não reconecta nem avisa queda', () => {
    const { ws, onLost } = client()
    ws.connect()
    latest().open()

    ws.disconnect()
    latest().drop(1000)
    vi.advanceTimersByTime(60_000)

    expect(onLost).not.toHaveBeenCalled()
    expect(FakeSocket.instances).toHaveLength(1)
  })
})
