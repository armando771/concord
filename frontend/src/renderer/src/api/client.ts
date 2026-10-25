import { useAuthStore } from '../store/authStore'
import { API_BASE_URL } from '../lib/config'
import {
  AUTH_STORAGE_KEY,
  parseStoredTokens,
  planRefresh,
  planRefreshFailure,
  REFRESH_LOCK,
  runExclusive,
  type StoredTokens,
  type Tokens
} from '../lib/authRefresh'

export class ApiError extends Error {
  status: number

  constructor(status: number, message: string) {
    super(message)
    this.status = status
  }
}

async function rawRequest<T>(path: string, options: RequestInit = {}, token?: string): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> | undefined)
  }

  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 15000)

  let response: Response
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      ...options,
      headers,
      signal: controller.signal
    })
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new ApiError(0, 'Request timed out')
    }
    throw err
  } finally {
    clearTimeout(timeout)
  }

  if (!response.ok) {
    const body = await response.json().catch(() => ({}))
    const message = (body as { error?: string }).error ?? 'Request failed'
    throw new ApiError(response.status, message)
  }

  if (response.status === 204) {
    return undefined as T
  }

  return (await response.json()) as T
}

function storedTokens(): StoredTokens {
  try {
    return parseStoredTokens(localStorage.getItem(AUTH_STORAGE_KEY))
  } catch {
    // Sem acesso ao armazenamento: vale o que está em memória.
    const { accessToken, refreshToken } = useAuthStore.getState()
    return { accessToken, refreshToken }
  }
}

function adopt(tokens: Tokens): true {
  useAuthStore.getState().setTokens(tokens.accessToken, tokens.refreshToken)
  return true
}

/** Recusado (ou falhou): limpa só se ninguém renovou nesse meio-tempo. */
function onRefreshFailed(failedRefreshToken: string): boolean {
  const plan = planRefreshFailure(failedRefreshToken, storedTokens())
  if (plan.kind === 'adopt') return adopt(plan.tokens)
  useAuthStore.getState().clear()
  return false
}

async function refreshLocked(failedAccessToken: string | null): Promise<boolean> {
  const plan = planRefresh(failedAccessToken, storedTokens())
  if (plan.kind === 'adopt') return adopt(plan.tokens)
  if (plan.kind === 'logged-out') {
    // Outra aba saiu da conta: esta acompanha (sem nada para renovar).
    if (useAuthStore.getState().refreshToken) useAuthStore.getState().clear()
    return false
  }

  try {
    const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: plan.refreshToken })
    })

    if (!response.ok) return onRefreshFailed(plan.refreshToken)

    const data = (await response.json()) as {
      access_token: string
      refresh_token: string
    }
    useAuthStore.getState().setTokens(data.access_token, data.refresh_token)
    return true
  } catch {
    return onRefreshFailed(plan.refreshToken)
  }
}

let inflight: Promise<boolean> | null = null

/**
 * Renova o access token. Uma renovação por vez: na mesma aba os 401
 * simultâneos esperam a mesma; entre abas, o Web Lock faz cada uma esperar a
 * outra e, ao entrar, usar os tokens que a anterior salvou.
 */
async function refreshTokens(
  failedAccessToken: string | null = useAuthStore.getState().accessToken
): Promise<boolean> {
  if (!useAuthStore.getState().refreshToken && !storedTokens().refreshToken) return false
  inflight ??= runExclusive(
    typeof navigator !== 'undefined' ? navigator.locks : undefined,
    REFRESH_LOCK,
    () => refreshLocked(failedAccessToken)
  ).finally(() => {
    inflight = null
  })
  return inflight
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const { accessToken } = useAuthStore.getState()

  try {
    return await rawRequest<T>(path, options, accessToken ?? undefined)
  } catch (err) {
    if (err instanceof ApiError && err.status === 401 && accessToken) {
      const refreshed = await refreshTokens(accessToken)
      if (refreshed) {
        const newToken = useAuthStore.getState().accessToken
        return rawRequest<T>(path, options, newToken ?? undefined)
      }
    }
    throw err
  }
}

export { rawRequest, refreshTokens, request }
