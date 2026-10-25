import { describe, expect, it, vi } from 'vitest'
import {
  isDefinitiveRejection,
  parseStoredTokens,
  planRefresh,
  planRefreshFailure,
  planRefreshSuccess,
  runExclusive,
  type StoredTokens
} from './authRefresh'

const stored = (accessToken: string | null, refreshToken: string | null): StoredTokens => ({
  accessToken,
  refreshToken
})

describe('parseStoredTokens', () => {
  it('lê os tokens do estado salvo pelo zustand persist', () => {
    const raw = JSON.stringify({
      state: { accessToken: 'a1', refreshToken: 'r1', user: { id: 'u' } },
      version: 0
    })
    expect(parseStoredTokens(raw)).toEqual(stored('a1', 'r1'))
  })

  it('nada salvo, JSON quebrado ou formato inesperado: sem tokens', () => {
    expect(parseStoredTokens(null)).toEqual(stored(null, null))
    expect(parseStoredTokens('{quebrado')).toEqual(stored(null, null))
    expect(parseStoredTokens(JSON.stringify({ state: { accessToken: 3 } }))).toEqual(
      stored(null, null)
    )
  })
})

describe('planRefresh', () => {
  it('ninguém renovou ainda: renova com o refresh token salvo', () => {
    expect(planRefresh('a1', stored('a1', 'r1'))).toEqual({ kind: 'refresh', refreshToken: 'r1' })
  })

  it('outra aba já renovou (access salvo é outro): usa os tokens dela, sem rede', () => {
    expect(planRefresh('a1', stored('a2', 'r2'))).toEqual({
      kind: 'adopt',
      tokens: { accessToken: 'a2', refreshToken: 'r2' }
    })
  })

  it('outra aba saiu da conta: não renova', () => {
    expect(planRefresh('a1', stored(null, null))).toEqual({ kind: 'logged-out' })
    expect(planRefresh('a1', stored('a1', null))).toEqual({ kind: 'logged-out' })
  })
})

describe('planRefreshFailure', () => {
  it('o refresh token recusado ainda é o salvo: aí sim limpa a sessão', () => {
    expect(planRefreshFailure('r1', stored('a1', 'r1'))).toEqual({ kind: 'clear' })
  })

  it('outra aba renovou enquanto isso: não apaga, usa os tokens novos', () => {
    expect(planRefreshFailure('r1', stored('a2', 'r2'))).toEqual({
      kind: 'adopt',
      tokens: { accessToken: 'a2', refreshToken: 'r2' }
    })
  })

  it('outra aba já saiu: nada a limpar no armazenamento', () => {
    expect(planRefreshFailure('r1', stored(null, null))).toEqual({ kind: 'logged-out' })
  })
})

describe('planRefreshSuccess', () => {
  const fresh = { accessToken: 'a2', refreshToken: 'r2' }

  it('o refresh token usado ainda é o salvo: salva os tokens novos', () => {
    expect(planRefreshSuccess('r1', stored('a1', 'r1'), fresh)).toEqual({
      kind: 'save',
      tokens: fresh
    })
  })

  it('saiu da conta (nesta ou noutra aba) durante a renovação: descarta, não volta a logar', () => {
    expect(planRefreshSuccess('r1', stored(null, null), fresh)).toEqual({ kind: 'logged-out' })
    expect(planRefreshSuccess('r1', stored('a1', null), fresh)).toEqual({ kind: 'logged-out' })
  })

  it('entrou outra sessão no meio (outro login): fica com a salva, descarta a nova', () => {
    expect(planRefreshSuccess('r1', stored('a9', 'r9'), fresh)).toEqual({
      kind: 'adopt',
      tokens: { accessToken: 'a9', refreshToken: 'r9' }
    })
  })
})

describe('isDefinitiveRejection', () => {
  it('só 401/403 do servidor encerram a sessão', () => {
    expect(isDefinitiveRejection(401)).toBe(true)
    expect(isDefinitiveRejection(403)).toBe(true)
  })

  it('falha de rede, tempo esgotado (0) ou erro do servidor (5xx, 429) mantêm o login', () => {
    for (const status of [0, 400, 404, 429, 500, 502, 503, 504]) {
      expect(isDefinitiveRejection(status)).toBe(false)
    }
  })
})

describe('runExclusive', () => {
  it('com Web Locks, roda dentro do lock com o nome pedido', async () => {
    const request = vi.fn((_name: string, cb: () => Promise<number>) => cb())
    const result = await runExclusive({ request } as unknown as LockManager, 'trava', async () => 7)
    expect(result).toBe(7)
    expect(request).toHaveBeenCalledWith('trava', expect.any(Function))
  })

  it('sem Web Locks (navegador antigo): roda direto', async () => {
    expect(await runExclusive(undefined, 'trava', async () => 'ok')).toBe('ok')
  })

  it('um após o outro: o segundo só começa quando o primeiro termina', async () => {
    // LockManager falso com fila, como o do navegador.
    let tail = Promise.resolve()
    const locks = {
      request: (_name: string, cb: () => Promise<unknown>) => {
        const run = tail.then(cb)
        tail = run.then(
          () => {},
          () => {}
        )
        return run
      }
    } as unknown as LockManager
    const order: string[] = []
    const job = (id: string) => async (): Promise<void> => {
      order.push(`${id}:início`)
      await new Promise((r) => setTimeout(r, 5))
      order.push(`${id}:fim`)
    }
    await Promise.all([runExclusive(locks, 't', job('A')), runExclusive(locks, 't', job('B'))])
    expect(order).toEqual(['A:início', 'A:fim', 'B:início', 'B:fim'])
  })
})
