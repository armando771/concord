import { WS_URL } from '../lib/config'

export type WsEventType =
  | 'message:create'
  | 'message:delete'
  | 'message:poll:update'
  | 'presence:update'
  | 'channel:create'
  | 'channel:update'
  | 'channel:delete'
  | 'server:update'
  | 'server:delete'
  | 'server:member:join'
  | 'server:member:leave'
  | 'friend:request'
  | 'friend:request:accepted'
  | 'friend:request:declined'
  | 'friend:request:cancelled'
  | 'friend:removed'

export interface WsEvent<T = unknown> {
  type: WsEventType | string
  payload: T
}

interface WsClientConfig {
  getToken: () => string | null
  getUserId: () => string | null
  onEvent: (event: WsEvent) => void
  /** Conexão (re)aberta, depois de reassinar as salas. */
  onOpen?: () => void
}

const BACKOFF_BASE_MS = 1000
const BACKOFF_MAX_MS = 30000

export class WsClient {
  private config: WsClientConfig
  private ws: WebSocket | null = null
  private subscriptions = new Set<string>()
  private closedByUser = false
  private retryDelay = BACKOFF_BASE_MS
  private retryTimer: ReturnType<typeof setTimeout> | null = null

  constructor(config: WsClientConfig) {
    this.config = config
  }

  connect(): void {
    this.closedByUser = false
    this.open()
  }

  disconnect(): void {
    this.closedByUser = true
    this.clearRetry()
    this.subscriptions.clear()
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
  }

  isConnected(): boolean {
    return this.ws?.readyState === WebSocket.OPEN
  }

  subscribe(room: string): void {
    this.subscriptions.add(room)
    this.send({ type: 'subscribe', payload: { room } })
  }

  unsubscribe(room: string): void {
    this.subscriptions.delete(room)
    this.send({ type: 'unsubscribe', payload: { room } })
  }

  sendEvent(type: string, payload: unknown): void {
    this.send({ type, payload })
  }

  private open(): void {
    const token = this.config.getToken()
    if (!token || this.closedByUser) return
    if (
      this.ws &&
      (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING)
    ) {
      return
    }

    const ws = new WebSocket(`${WS_URL}?token=${encodeURIComponent(token)}`)

    ws.onopen = () => {
      this.retryDelay = BACKOFF_BASE_MS
      const userId = this.config.getUserId()
      if (userId) this.subscriptions.add(`user:${userId}`)
      for (const room of this.subscriptions) {
        this.send({ type: 'subscribe', payload: { room } })
      }
      this.config.onOpen?.()
    }

    ws.onmessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data as string) as WsEvent
        this.config.onEvent(data)
      } catch {
        // ignore malformed frames
      }
    }

    ws.onclose = () => {
      this.ws = null
      if (!this.closedByUser) this.scheduleReconnect()
    }

    ws.onerror = () => {
      ws.close()
    }

    this.ws = ws
  }

  private send(event: WsEvent): void {
    if (!this.isConnected()) return
    const raw = JSON.stringify(event)
    this.sendRaw(raw)
  }

  private sendRaw(raw: string): void {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return
    this.ws.send(raw)
  }

  private scheduleReconnect(): void {
    this.clearRetry()
    this.retryTimer = setTimeout(() => {
      this.open()
    }, this.retryDelay)
    this.retryDelay = Math.min(this.retryDelay * 2, BACKOFF_MAX_MS)
  }

  private clearRetry(): void {
    if (this.retryTimer) {
      clearTimeout(this.retryTimer)
      this.retryTimer = null
    }
  }
}
