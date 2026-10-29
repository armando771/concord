import {
  isDefinitiveRejection,
  planRefresh,
  planRefreshFailure,
  planRefreshSuccess,
  type StoredTokens
} from './authRefresh'

const stored = (accessToken: string | null, refreshToken: string | null): StoredTokens => ({
  accessToken,
  refreshToken
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
