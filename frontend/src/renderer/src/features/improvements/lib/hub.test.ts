import { describe, expect, it } from 'vitest'
import type { Proposal } from '../../proposals/api/proposals'
import { isHubPath, proposalsStat, rankStat } from './hub'

const p = (status: string): Proposal => ({ status }) as unknown as Proposal

describe('isHubPath', () => {
  it.each(['/melhorias', '/proposals', '/changelog', '/ranking'])('%s é da aba', (path) => {
    expect(isHubPath(path)).toBe(true)
  })

  it.each(['/', '/friends', '/dm/u1', '/servers/s1', '/rankings'])('%s não é', (path) => {
    expect(isHubPath(path)).toBe(false)
  })
})

describe('proposalsStat', () => {
  it('sem quadro carregado, não mostra nada', () => {
    expect(proposalsStat([], false)).toBeNull()
  })

  it('conta só as em votação', () => {
    expect(proposalsStat([p('voting'), p('done'), p('voting')], true)).toBe('2 em votação')
    expect(proposalsStat([p('voting')], true)).toBe('1 em votação')
    expect(proposalsStat([p('done')], true)).toBe('Nenhuma em votação')
  })
})

describe('rankStat', () => {
  it('mostra a posição quando há', () => {
    expect(rankStat(true, { position: 4, level: 9, xp: 1 })).toBe('Sua posição: #4')
  })

  it('sem ranking carregado, não mostra nada', () => {
    expect(rankStat(false, null)).toBeNull()
  })
})
