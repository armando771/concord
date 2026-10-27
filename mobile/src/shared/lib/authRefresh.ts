// Renovação do login. O refresh token é de uso único: duas renovações com o
// mesmo (ex.: chamadas simultâneas) recusam a segunda — e ela não pode apagar
// os tokens novos que a primeira salvou. As decisões são puras para testar;
// o shared/api/client.ts executa. Porte do desktop, sem o lock entre abas.

export interface StoredTokens {
  accessToken: string | null
  refreshToken: string | null
}

export interface Tokens {
  accessToken: string
  refreshToken: string
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
