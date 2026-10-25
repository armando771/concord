import { fetchMediaToken } from '../api/attachments'
import { useAuthStore } from './authStore'

// Token de mídia em memória, dividido por todas as imagens/vídeos/áudios da
// tela. Renova 10 min antes de vencer, para uma URL nova nunca nascer morta.
const RENEW_BEFORE_MS = 10 * 60_000

export interface CachedMediaToken {
  token: string
  expiresAt: number
  /** Access token de quando foi pedido: trocou (login/logout) → pede outro. */
  accessToken: string
}

let cached: CachedMediaToken | null = null
let pending: Promise<string> | null = null

export function needsNewMediaToken(
  current: CachedMediaToken | null,
  accessToken: string | null,
  now: number
): boolean {
  if (!current) return true
  if (current.accessToken !== accessToken) return true
  return current.expiresAt - now < RENEW_BEFORE_MS
}

export function ensureMediaToken(now: number = Date.now()): Promise<string> {
  const accessToken = useAuthStore.getState().accessToken
  if (cached && !needsNewMediaToken(cached, accessToken, now)) {
    return Promise.resolve(cached.token)
  }
  if (pending) return pending

  const request = fetchMediaToken()
    .then(({ token, expires_at }) => {
      // O request pode ter renovado o login no meio (401 → refresh).
      cached = {
        token,
        expiresAt: Date.parse(expires_at),
        accessToken: useAuthStore.getState().accessToken ?? ''
      }
      return token
    })
    .finally(() => {
      if (pending === request) pending = null
    })
  pending = request
  return request
}

/** Descarta o token (ex.: o servidor recusou um arquivo com ele). */
export function invalidateMediaToken(): void {
  cached = null
  pending = null
}
