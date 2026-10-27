import type { StoredTokens, Tokens } from '../lib/authRefresh'

// Porta entre o cliente HTTP/WS (shared) e a sessão (features/auth): shared não
// importa de features, então o authStore se liga aqui no boot (bindSession).
export interface SessionPort {
  tokens(): StoredTokens
  /** Id da conta logada (a sala `user:<id>` do WebSocket), ou null. */
  userId(): string | null
  setTokens(tokens: Tokens): Promise<void>
  /** Sessão recusada pelo servidor: sai da conta com o aviso de expirada. */
  expire(): Promise<void>
}

let port: SessionPort | null = null

export function bindSession(next: SessionPort): void {
  port = next
}

export function session(): SessionPort {
  if (!port) throw new Error('sessão não ligada: chame bindSession no boot do app')
  return port
}
