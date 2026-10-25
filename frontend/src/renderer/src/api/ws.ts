import { WS_URL } from '../lib/config'
import { isPlannedRestart, reconnectDelay } from '../lib/wsReconnect'

export type WsEventType =
  | 'message:create'
  | 'message:delete'
  | 'message:poll:update'
  | 'level:update'
  | 'level:up'
  | 'badge:unlock'
  | 'presence:update'
  | 'channel:create'
  | 'channel:update'
  | 'channel:delete'
  | 'channel:reorder'
  | 'server:update'
  | 'server:delete'
  | 'server:member:join'
  | 'server:member:update'
  | 'server:member:leave'
  | 'server:member:roles'
  | 'server:member:nickname'
  | 'server:removed'
  | 'server:permissions:invalidate'
  | 'server:invite_code'
  | 'role:create'
  | 'role:update'
  | 'role:delete'
  | 'role:reorder'
  | 'user:update'
  | 'friend:request'
  | 'friend:request:accepted'
  | 'friend:request:declined'
  | 'friend:request:cancelled'
  | 'friend:removed'
  | 'typing'
  | 'typing:stop'

export interface WsEvent<T = unknown> {
  type: WsEventType | string
  payload: T
}

interface WsClientConfig {
  getToken: () => string | null
  getUserId: () => string | null
  onEvent: (event: WsEvent) => void
  /**
   * Conexão (re)aberta, depois de reassinar as salas. `reconnected`: já tinha
   * aberto antes desde o connect() — eventos da queda podem ter se perdido.
   */
  onOpen?: (reconnected: boolean) => void
  /** Conexão caiu (ou uma tentativa de reconectar falhou) sem ser por disconnect(). */
  onLost?: () => void
}

export class WsClient {
  private config: WsClientConfig
  private ws: WebSocket | null = null
  private subscriptions = new Set<string>()
  private closedByUser = false
  /** Tentativas de reconectar desde a última conexão aberta. */
  private attempt = 0
  /** O servidor avisou que estava reiniciando (1012): reconecta logo. */
  private serverRestarting = false
  /** Já abriu alguma vez desde o connect(). */
  private everOpened = false
  private retryTimer: ReturnType<typeof setTimeout> | null = null

  constructor(config: WsClientConfig) {
    this.config = config
  }

  connect(): void {
    this.closedByUser = false
    this.everOpened = false
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
      this.attempt = 0
      this.serverRestarting = false
      const userId = this.config.getUserId()
      if (userId) this.subscriptions.add(`user:${userId}`)
      for (const room of this.subscriptions) {
        this.send({ type: 'subscribe', payload: { room } })
      }
      const reconnected = this.everOpened
      this.everOpened = true
      this.config.onOpen?.(reconnected)
    }

    ws.onmessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data as string) as WsEvent
        this.config.onEvent(data)
      } catch {
        // ignore malformed frames
      }
    }

    ws.onclose = (event: CloseEvent) => {
      if (this.ws === ws) this.ws = null
      if (this.closedByUser) return
      if (isPlannedRestart(event.code)) this.serverRestarting = true
      this.config.onLost?.()
      this.scheduleReconnect()
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
    const delay = reconnectDelay(this.attempt, this.serverRestarting)
    this.attempt++
    this.retryTimer = setTimeout(() => {
      this.open()
    }, delay)
  }

  private clearRetry(): void {
    if (this.retryTimer) {
      clearTimeout(this.retryTimer)
      this.retryTimer = null
    }
  }
}
