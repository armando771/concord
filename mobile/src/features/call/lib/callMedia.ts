export type MediaConnection = 'connected' | 'reconnecting' | 'disconnected'

/**
 * A mídia da chamada (LiveKit). Porta: só `livekitMedia.ts` fala com o SDK; o resto do app e os testes usam esta
 * interface (ADR 0023).
 */
export interface CallMedia {
  connect(url: string, token: string): Promise<void>
  disconnect(): Promise<void>
  /** Liga ou desliga o microfone; rejeita se o sistema negou a permissão. */
  setMicEnabled(on: boolean): Promise<void>
  /** Liga ou desliga o áudio que chega (fone). */
  setListening(on: boolean): void
  onSpeakers(listener: (userIds: string[]) => void): () => void
  onConnection(listener: (state: MediaConnection) => void): () => void
}
