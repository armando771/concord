import { describe, expect, it } from 'vitest'
import type { Proposal } from '../api/proposals'
import { canVote, mergeProposal, pendingVoteCount, timeLeftLabel, yesPercent } from './proposals'

const NOW = new Date('2026-10-25T12:00:00Z').getTime()
const at = (ms: number): string => new Date(NOW + ms).toISOString()
const H = 3_600_000

const base: Proposal = {
  id: 'p1',
  author_id: 'u1',
  author_name: 'Ana',
  title: 'Modo escuro',
  description: '',
  status: 'voting',
  created_at: at(-H),
  voting_ends_at: at(2 * 24 * H),
  yes_votes: 0,
  no_votes: 0
}

describe('timeLeftLabel', () => {
  it('formata dias, horas e minutos', () => {
    expect(timeLeftLabel(at(3 * 24 * H + 4 * H + 5000), NOW)).toBe('3d 4h')
    expect(timeLeftLabel(at(5 * H + 20 * 60_000 + 5000), NOW)).toBe('5h 20min')
    expect(timeLeftLabel(at(12 * 60_000 + 5000), NOW)).toBe('12min')
  })
  it('passou do prazo vira encerrando', () => {
    expect(timeLeftLabel(at(-1000), NOW)).toBe('encerrando')
    expect(timeLeftLabel('lixo', NOW)).toBe('encerrando')
  })
})

describe('yesPercent', () => {
  it('é 0 sem votos e arredonda', () => {
    expect(yesPercent({ yes_votes: 0, no_votes: 0 })).toBe(0)
    expect(yesPercent({ yes_votes: 2, no_votes: 1 })).toBe(67)
  })
})

describe('canVote / pendingVoteCount', () => {
  it('só vota em votação e dentro do prazo', () => {
    expect(canVote(base, NOW)).toBe(true)
    expect(canVote({ ...base, status: 'proposed' }, NOW)).toBe(false)
    expect(canVote({ ...base, voting_ends_at: at(-1) }, NOW)).toBe(false)
  })
  it('conta só o que falta votar', () => {
    const list = [
      base,
      { ...base, id: 'p2', my_vote: false },
      { ...base, id: 'p3', status: 'done' as const }
    ]
    expect(pendingVoteCount(list, NOW)).toBe(1)
  })
})

describe('mergeProposal', () => {
  it('mantém o meu voto quando o evento não traz', () => {
    const list = [{ ...base, my_vote: true }]
    const out = mergeProposal(list, { ...base, yes_votes: 3 })
    expect(out[0].yes_votes).toBe(3)
    expect(out[0].my_vote).toBe(true)
  })
  it('card novo entra no começo', () => {
    const out = mergeProposal([base], { ...base, id: 'p9' })
    expect(out.map((p) => p.id)).toEqual(['p9', 'p1'])
  })
})
