// Renovação do login segura com várias abas (app web). O refresh token é de
// uso único: se duas abas renovam com o mesmo, a segunda é recusada — e não
// pode apagar os tokens novos que a primeira acabou de salvar. As decisões
// são puras para testar; o api/client.ts executa.

/** Chave do zustand persist do authStore (localStorage). */
export const AUTH_STORAGE_KEY = 'concord-auth'
/** Nome do Web Lock que deixa uma aba por vez renovar ou sair da conta. */
export const REFRESH_LOCK = 'salinha-auth-refresh'

export interface StoredTokens {
  accessToken: string | null
  refreshToken: string | null
}

export interface Tokens {
  accessToken: string
  refreshToken: string
}

const str = (value: unknown): string | null => (typeof value === 'string' && value ? value : null)

/** Tokens no estado salvo pelo persist (`{ state: {...}, version }`). */
export function parseStoredTokens(raw: string | null): StoredTokens {
  try {
    const state = (JSON.parse(raw ?? 'null') as { state?: Record<string, unknown> } | null)?.state
    return { accessToken: str(state?.accessToken), refreshToken: str(state?.refreshToken) }
  } catch {
    return { accessToken: null, refreshToken: null }
  }
}

export type RefreshPlan =
  | { kind: 'refresh'; refreshToken: string }
  | { kind: 'adopt'; tokens: Tokens }
  | { kind: 'logged-out' }

/**
 * Já com o lock, antes de ir à rede: `failedAccessToken` é o que levou 401.
 * Se o salvo é outro, alguma aba já renovou — usa os tokens dela.
 */
export function planRefresh(failedAccessToken: string | null, stored: StoredTokens): RefreshPlan {
  if (!stored.refreshToken) return { kind: 'logged-out' }
  if (stored.accessToken && stored.accessToken !== failedAccessToken) {
    return {
      kind: 'adopt',
      tokens: { accessToken: stored.accessToken, refreshToken: stored.refreshToken }
    }
  }
  return { kind: 'refresh', refreshToken: stored.refreshToken }
}

export type FailurePlan =
  { kind: 'clear' } | { kind: 'adopt'; tokens: Tokens } | { kind: 'logged-out' }

/** O servidor recusou `failedRefreshToken`: só limpa se ele ainda é o salvo. */
export function planRefreshFailure(failedRefreshToken: string, stored: StoredTokens): FailurePlan {
  if (!stored.refreshToken) return { kind: 'logged-out' }
  if (stored.refreshToken === failedRefreshToken) return { kind: 'clear' }
  if (!stored.accessToken) return { kind: 'clear' }
  return {
    kind: 'adopt',
    tokens: { accessToken: stored.accessToken, refreshToken: stored.refreshToken }
  }
}

export type SuccessPlan =
  { kind: 'save'; tokens: Tokens } | { kind: 'adopt'; tokens: Tokens } | { kind: 'logged-out' }

/**
 * O servidor renovou com `usedRefreshToken`. Só salva os tokens novos se o
 * salvo ainda é o usado: se a sessão saiu (logout nesta ou noutra aba) ou foi
 * trocada no meio, os novos são descartados — um logout não pode "voltar".
 */
export function planRefreshSuccess(
  usedRefreshToken: string,
  stored: StoredTokens,
  fresh: Tokens
): SuccessPlan {
  if (stored.refreshToken === usedRefreshToken) return { kind: 'save', tokens: fresh }
  if (!stored.refreshToken || !stored.accessToken) return { kind: 'logged-out' }
  return {
    kind: 'adopt',
    tokens: { accessToken: stored.accessToken, refreshToken: stored.refreshToken }
  }
}

/**
 * Resposta que encerra a sessão: só 401/403 (o servidor recusou o token).
 * Falha de rede, tempo esgotado (status 0) ou erro do servidor mantêm o login
 * — com a sincronização entre abas, limpar por isso deslogaria todas.
 */
export function isDefinitiveRejection(status: number): boolean {
  return status === 401 || status === 403
}

/**
 * Roda `fn` com exclusividade entre as abas (Web Locks). Sem a API (navegador
 * antigo), roda direto. No Electron a API existe; com uma janela só, o lock
 * apenas nunca é disputado.
 */
export function runExclusive<T>(
  locks: LockManager | undefined,
  name: string,
  fn: () => Promise<T>
): Promise<T> {
  if (!locks?.request) return fn()
  return locks.request(name, fn) as Promise<T>
}
