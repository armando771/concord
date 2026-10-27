import { ApiError, rawRequest, request, refreshSession } from './client'
import { bindSession } from './session'
import type { StoredTokens, Tokens } from '../lib/authRefresh'

let tokens: StoredTokens
const setTokens = jest.fn(async (next: Tokens) => void (tokens = next))
const expire = jest.fn(async () => void (tokens = { accessToken: null, refreshToken: null }))
const fetchMock = jest.fn()

const json = (status: number, body: unknown = {}) =>
  Promise.resolve({ ok: status >= 200 && status < 300, status, json: async () => body })

beforeEach(() => {
  jest.clearAllMocks()
  tokens = { accessToken: 'a1', refreshToken: 'r1' }
  bindSession({ tokens: () => tokens, userId: () => 'u1', setTokens, expire })
  global.fetch = fetchMock as unknown as typeof fetch
})

describe('rawRequest', () => {
  it('manda o JSON e o token e devolve o corpo', async () => {
    fetchMock.mockReturnValueOnce(json(200, { ok: 1 }))
    expect(await rawRequest('/x', { method: 'POST' }, 'tok')).toEqual({ ok: 1 })
    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toBe('http://localhost:8080/api/x')
    expect(init.headers).toMatchObject({ 'Content-Type': 'application/json', Authorization: 'Bearer tok' })
  })

  it('204 devolve undefined', async () => {
    fetchMock.mockReturnValueOnce(json(204))
    expect(await rawRequest('/x')).toBeUndefined()
  })

  it('erro da API vira ApiError com status, code e corpo', async () => {
    fetchMock.mockReturnValueOnce(json(409, { error: 'dup', code: 'taken' }))
    await expect(rawRequest('/x')).rejects.toMatchObject({ status: 409, message: 'dup', code: 'taken' })
  })

  it('erro sem corpo JSON usa a mensagem padrão', async () => {
    fetchMock.mockReturnValueOnce(Promise.resolve({ ok: false, status: 500, json: async () => { throw new Error('x') } }))
    await expect(rawRequest('/x')).rejects.toMatchObject({ status: 500, message: 'Request failed' })
  })

  it('estoura o tempo em 15 s: ApiError(0)', async () => {
    jest.useFakeTimers()
    fetchMock.mockImplementationOnce(
      (_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => reject(new DOMException('abort', 'AbortError')))
        })
    )
    const pending = rawRequest('/x')
    const assertion = expect(pending).rejects.toMatchObject({ status: 0 })
    await jest.advanceTimersByTimeAsync(15_000)
    await assertion
    jest.useRealTimers()
  })
})

describe('request: renovação no 401', () => {
  const refreshOk = () => json(200, { access_token: 'a2', refresh_token: 'r2' })

  it('401 renova uma vez e repete a chamada com o token novo', async () => {
    fetchMock
      .mockReturnValueOnce(json(401))
      .mockReturnValueOnce(refreshOk())
      .mockReturnValueOnce(json(200, { v: 1 }))
    expect(await request('/me')).toEqual({ v: 1 })
    expect(setTokens).toHaveBeenCalledWith({ accessToken: 'a2', refreshToken: 'r2' })
    expect(fetchMock.mock.calls[2][1].headers.Authorization).toBe('Bearer a2')
  })

  it('vários 401 simultâneos fazem uma única renovação', async () => {
    fetchMock.mockImplementation((url: string, init: RequestInit) => {
      if (url.endsWith('/auth/refresh')) return refreshOk()
      const auth = (init.headers as Record<string, string>).Authorization
      return auth === 'Bearer a1' ? json(401) : json(200, { ok: true })
    })
    await Promise.all([request('/a'), request('/b'), request('/c')])
    const refreshes = fetchMock.mock.calls.filter(([url]) => String(url).endsWith('/auth/refresh'))
    expect(refreshes).toHaveLength(1)
  })

  it('refresh recusado (401/403) encerra a sessão com expire()', async () => {
    fetchMock.mockReturnValueOnce(json(401)).mockReturnValueOnce(json(401))
    await expect(request('/me')).rejects.toBeInstanceOf(ApiError)
    expect(expire).toHaveBeenCalledTimes(1)
  })

  it('falha de rede ao renovar mantém a sessão e vira ApiError(0)', async () => {
    fetchMock.mockReturnValueOnce(json(401)).mockRejectedValueOnce(new TypeError('network'))
    await expect(request('/me')).rejects.toMatchObject({ status: 0 })
    expect(expire).not.toHaveBeenCalled()
  })

  it('erro 500 ao renovar também mantém a sessão', async () => {
    fetchMock.mockReturnValueOnce(json(401)).mockReturnValueOnce(json(500))
    await expect(request('/me')).rejects.toMatchObject({ status: 0 })
    expect(expire).not.toHaveBeenCalled()
  })

  it('sem sessão não tenta renovar', async () => {
    tokens = { accessToken: null, refreshToken: null }
    fetchMock.mockReturnValueOnce(json(401))
    await expect(request('/me')).rejects.toMatchObject({ status: 401 })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('refreshSession sem refresh token é "rejected"', async () => {
    tokens = { accessToken: null, refreshToken: null }
    expect(await refreshSession()).toBe('rejected')
  })
})
