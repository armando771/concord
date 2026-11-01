import { WsClient, onWsEvent, type WsEvent } from './ws'

class FakeSocket {
  static instances: FakeSocket[] = []
  static OPEN = 1
  static CONNECTING = 0
  readyState = FakeSocket.CONNECTING
  sent: string[] = []
  onopen: (() => void) | null = null
  onmessage: ((e: { data: string }) => void) | null = null
  onclose: ((e: { code: number }) => void) | null = null
  onerror: (() => void) | null = null
  constructor(public url: string) {
    FakeSocket.instances.push(this)
  }
  send(raw: string) {
    this.sent.push(raw)
  }
  close() {
    this.readyState = 3
  }
  open() {
    this.readyState = FakeSocket.OPEN
    this.onopen?.()
  }
  drop(code = 1006) {
    this.readyState = 3
    this.onclose?.({ code })
  }
  message(event: WsEvent) {
    this.onmessage?.({ data: JSON.stringify(event) })
  }
}

const last = () => FakeSocket.instances[FakeSocket.instances.length - 1]

function makeClient(token: string | null = 'tok') {
  const onEvent = jest.fn()
  const onOpen = jest.fn()
  const onLost = jest.fn()
  const client = new WsClient({ getToken: () => token, getUserId: () => 'u1', onEvent, onOpen, onLost })
  return { client, onEvent, onOpen, onLost }
}

beforeEach(() => {
  jest.useFakeTimers()
  FakeSocket.instances = []
  ;(global as unknown as { WebSocket: unknown }).WebSocket = FakeSocket
})

afterEach(() => jest.useRealTimers())

describe('WsClient', () => {
  it('conecta com o token na URL e assina a sala do usuário', () => {
    const { client, onOpen } = makeClient()
    client.connect()
    expect(last().url).toBe('ws://localhost:8080/ws?token=tok')
    last().open()
    expect(JSON.parse(last().sent[0])).toEqual({ type: 'subscribe', payload: { room: 'user:u1' } })
    expect(onOpen).toHaveBeenCalledWith(false)
  })

  it('sem token não conecta', () => {
    makeClient(null).client.connect()
    expect(FakeSocket.instances).toHaveLength(0)
  })

  it('entrega o evento ao onEvent e aos ouvintes extras', () => {
    const { client, onEvent } = makeClient()
    const extra = jest.fn()
    const off = onWsEvent(extra)
    client.connect()
    last().open()
    last().message({ type: 'typing', payload: { a: 1 } })
    expect(onEvent).toHaveBeenCalledWith({ type: 'typing', payload: { a: 1 } })
    expect(extra).toHaveBeenCalledTimes(1)
    off()
    last().message({ type: 'typing', payload: {} })
    expect(extra).toHaveBeenCalledTimes(1)
  })

  it('quadro malformado é ignorado', () => {
    const { client, onEvent } = makeClient()
    client.connect()
    last().open()
    last().onmessage?.({ data: '{quebrado' })
    expect(onEvent).not.toHaveBeenCalled()
  })

  it('reconecta com backoff depois de cair e avisa que reconectou', () => {
    const { client, onOpen, onLost } = makeClient()
    client.connect()
    last().open()
    last().drop()
    expect(onLost).toHaveBeenCalledWith({ attempt: 1, planned: false })
    expect(FakeSocket.instances).toHaveLength(1)
    jest.advanceTimersByTime(1000)
    expect(FakeSocket.instances).toHaveLength(2)
    last().open()
    expect(onOpen).toHaveBeenLastCalledWith(true)
  })

  it('reinício planejado (1012) reconecta em até 300 ms', () => {
    const { client, onLost } = makeClient()
    client.connect()
    last().open()
    last().drop(1012)
    expect(onLost).toHaveBeenCalledWith({ attempt: 1, planned: true })
    jest.advanceTimersByTime(300)
    expect(FakeSocket.instances).toHaveLength(2)
  })

  it('disconnect não reconecta', () => {
    const { client } = makeClient()
    client.connect()
    last().open()
    client.disconnect()
    last().drop()
    jest.advanceTimersByTime(60_000)
    expect(FakeSocket.instances).toHaveLength(1)
  })

  it('retryNow pula a espera do backoff', () => {
    const { client } = makeClient()
    client.connect()
    last().open()
    last().drop()
    client.retryNow()
    expect(FakeSocket.instances).toHaveLength(2)
  })

  it('retryNow com a conexão ativa não abre outra', () => {
    const { client } = makeClient()
    client.connect()
    last().open()
    client.retryNow()
    expect(FakeSocket.instances).toHaveLength(1)
  })

  it('reassina as salas ao reconectar', () => {
    const { client } = makeClient()
    client.connect()
    last().open()
    client.subscribe('channel:c1')
    last().drop()
    jest.advanceTimersByTime(1000)
    last().open()
    const rooms = last().sent.map((raw) => JSON.parse(raw).payload.room)
    expect(rooms).toEqual(expect.arrayContaining(['user:u1', 'channel:c1']))
  })
})
