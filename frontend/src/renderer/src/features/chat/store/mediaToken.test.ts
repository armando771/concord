import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../api/attachments', () => ({ fetchMediaToken: vi.fn() }))

import { fetchMediaToken } from '../api/attachments'
import { useAuthStore } from '../../auth/store/authStore'
import {
  ensureMediaToken,
  invalidateMediaToken,
  needsNewMediaToken,
  type CachedMediaToken
} from './mediaToken'

const MIN = 60_000
const fetchMock = vi.mocked(fetchMediaToken)

describe('needsNewMediaToken', () => {
  const now = Date.UTC(2026, 9, 24, 12)
  const cached = (minutesLeft: number): CachedMediaToken => ({
    token: 't',
    expiresAt: now + minutesLeft * MIN,
    accessToken: 'A'
  })

  it('pede token quando não há, quando o login mudou ou falta pouco', () => {
    expect(needsNewMediaToken(null, 'A', now)).toBe(true)
    expect(needsNewMediaToken(cached(30), 'A', now)).toBe(false)
    expect(needsNewMediaToken(cached(9), 'A', now)).toBe(true)
    expect(needsNewMediaToken(cached(30), 'B', now)).toBe(true)
  })
})

describe('ensureMediaToken', () => {
  beforeEach(() => {
    invalidateMediaToken()
    fetchMock.mockReset()
    useAuthStore.setState({ accessToken: 'A' })
  })

  it('pedidos ao mesmo tempo dividem uma busca', async () => {
    let resolve!: (v: { token: string; expires_at: string }) => void
    fetchMock.mockReturnValueOnce(new Promise((r) => (resolve = r)))
    const a = ensureMediaToken()
    const b = ensureMediaToken()
    resolve({ token: 'T1', expires_at: new Date(Date.now() + 60 * MIN).toISOString() })
    expect(await a).toBe('T1')
    expect(await b).toBe('T1')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    // Cache vale para os próximos.
    expect(await ensureMediaToken()).toBe('T1')
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('renova depois de invalidar', async () => {
    const expires = new Date(Date.now() + 60 * MIN).toISOString()
    fetchMock
      .mockResolvedValueOnce({ token: 'T1', expires_at: expires })
      .mockResolvedValueOnce({ token: 'T2', expires_at: expires })
    expect(await ensureMediaToken()).toBe('T1')
    invalidateMediaToken()
    expect(await ensureMediaToken()).toBe('T2')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('renova quando o token está perto de vencer', async () => {
    const expiresAt = Date.now() + 60 * MIN
    fetchMock
      .mockResolvedValueOnce({ token: 'T1', expires_at: new Date(expiresAt).toISOString() })
      .mockResolvedValueOnce({
        token: 'T2',
        expires_at: new Date(expiresAt + 60 * MIN).toISOString()
      })
    expect(await ensureMediaToken()).toBe('T1')
    expect(await ensureMediaToken(expiresAt - 5 * MIN)).toBe('T2')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('vários elementos com o mesmo token vencido pedem um só token novo', async () => {
    const expires = new Date(Date.now() + 60 * MIN).toISOString()
    fetchMock
      .mockResolvedValueOnce({ token: 'T1', expires_at: expires })
      .mockResolvedValueOnce({ token: 'T2', expires_at: expires })
    expect(await ensureMediaToken()).toBe('T1')
    // Três imagens quebradas com T1, ao mesmo tempo.
    invalidateMediaToken('T1')
    const a = ensureMediaToken()
    invalidateMediaToken('T1')
    const b = ensureMediaToken()
    invalidateMediaToken('T1')
    expect(await a).toBe('T2')
    expect(await b).toBe('T2')
    // Quem ainda usava T1 e falhou depois da renovação não derruba o T2.
    invalidateMediaToken('T1')
    expect(await ensureMediaToken()).toBe('T2')
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})
