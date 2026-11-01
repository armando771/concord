import { API_BASE_URL } from '../lib/config'
import {
  isDefinitiveRejection,
  planRefresh,
  planRefreshFailure,
  planRefreshSuccess,
  type Tokens
} from '../lib/authRefresh'
import { session } from './session'

export class ApiError extends Error {
  status: number
  /** Código do erro quando o servidor manda (ex.: "user_not_found"). */
  code?: string
  /** Corpo JSON da resposta de erro. */
  body: Record<string, unknown>

  constructor(status: number, message: string, code?: string, body: Record<string, unknown> = {}) {
    super(message)
    this.status = status
    this.code = code
    this.body = body
  }
}

const REQUEST_TIMEOUT_MS = 15_000

async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') throw new ApiError(0, 'Request timed out')
    throw err
  } finally {
    clearTimeout(timeout)
  }
}

async function errorFrom(response: Response): Promise<ApiError> {
  const body = await response.json().catch(() => ({}))
  const record = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>
  const { error, code } = record as { error?: string; code?: string }
  return new ApiError(response.status, error ?? 'Request failed', code, record)
}

async function rawRequest<T>(path: string, options: RequestInit = {}, token?: string): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined)
  }
  if (token) headers['Authorization'] = `Bearer ${token}`

  const response = await fetchWithTimeout(`${API_BASE_URL}${path}`, { ...options, headers })
  if (!response.ok) throw await errorFrom(response)
  if (response.status === 204) return undefined as T
  return (await response.json()) as T
}

/** Resultado da renovação. 'unavailable' = rede/servidor fora: o login fica. */
export type RefreshOutcome = 'ok' | 'rejected' | 'unavailable'

async function adopt(tokens: Tokens): Promise<'ok'> {
  await session().setTokens(tokens)
  return 'ok'
}

/** O servidor recusou (401/403): sai da conta, a menos que já tenham renovado. */
async function onRefreshRejected(failedRefreshToken: string): Promise<RefreshOutcome> {
  const plan = planRefreshFailure(failedRefreshToken, session().tokens())
  if (plan.kind === 'adopt') return adopt(plan.tokens)
  await session().expire()
  return 'rejected'
}

type RefreshCall = Tokens | 'rejected' | 'unavailable'

/** A chamada de rede; rede caída, tempo esgotado e erro 5xx não são recusa. */
async function callRefresh(refreshToken: string): Promise<RefreshCall> {
  try {
    const response = await fetchWithTimeout(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken })
    })
    if (!response.ok) return isDefinitiveRejection(response.status) ? 'rejected' : 'unavailable'
    const data = (await response.json()) as { access_token: string; refresh_token: string }
    return { accessToken: data.access_token, refreshToken: data.refresh_token }
  } catch {
    return 'unavailable'
  }
}

async function performRefresh(failedAccessToken: string | null): Promise<RefreshOutcome> {
  const plan = planRefresh(failedAccessToken, session().tokens())
  if (plan.kind === 'adopt') return adopt(plan.tokens)
  if (plan.kind === 'logged-out') return 'rejected'

  const result = await callRefresh(plan.refreshToken)
  if (result === 'unavailable') return result
  if (result === 'rejected') return onRefreshRejected(plan.refreshToken)

  const saved = planRefreshSuccess(plan.refreshToken, session().tokens(), result)
  // Saiu da conta enquanto renovava: os tokens novos são descartados.
  return saved.kind === 'logged-out' ? 'rejected' : adopt(saved.tokens)
}

let inflight: Promise<RefreshOutcome> | null = null

/** Renova o access token. Uma renovação por vez: os 401 simultâneos esperam a mesma. */
function refreshSession(failedAccessToken: string | null = session().tokens().accessToken): Promise<RefreshOutcome> {
  if (!session().tokens().refreshToken) return Promise.resolve('rejected')
  inflight ??= performRefresh(failedAccessToken).finally(() => {
    inflight = null
  })
  return inflight
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const { accessToken } = session().tokens()
  try {
    return await rawRequest<T>(path, options, accessToken ?? undefined)
  } catch (err) {
    if (!(err instanceof ApiError) || err.status !== 401 || !accessToken) throw err
    const outcome = await refreshSession(accessToken)
    // Sem rede para renovar: não é "login inválido" (quem chama não desloga).
    if (outcome === 'unavailable') throw new ApiError(0, 'Sem conexão com o servidor')
    if (outcome === 'rejected') throw err
    return rawRequest<T>(path, options, session().tokens().accessToken ?? undefined)
  }
}

export { rawRequest, refreshSession, request }
