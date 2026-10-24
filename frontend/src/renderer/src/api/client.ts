import { useAuthStore } from '../store/authStore'
import { API_BASE_URL } from '../lib/config'

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

async function refreshTokens(): Promise<boolean> {
  const { refreshToken, setTokens, clear } = useAuthStore.getState()
  if (!refreshToken) return false

  try {
    const response = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken })
    })

    if (!response.ok) {
      clear()
      return false
    }

    const data = (await response.json()) as {
      access_token: string
      refresh_token: string
    }
    setTokens(data.access_token, data.refresh_token)
    return true
  } catch {
    clear()
    return false
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const { accessToken } = useAuthStore.getState()

  try {
    return await rawRequest<T>(path, options, accessToken ?? undefined)
  } catch (err) {
    if (err instanceof ApiError && err.status === 401 && accessToken) {
      const refreshed = await refreshTokens()
      if (refreshed) {
        const newToken = useAuthStore.getState().accessToken
        return rawRequest<T>(path, options, newToken ?? undefined)
      }
    }
    throw err
  }
}

export { rawRequest, request }
