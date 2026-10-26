import { describe, expect, it } from 'vitest'
import { formatReleaseDate, groupEntries } from './changelog'

const release = {
  version: '0.6.2',
  released_at: '2026-10-24T15:00:00Z',
  summary: '',
  entries: [
    { kind: 'fix' as const, text: 'b' },
    { kind: 'feature' as const, text: 'a' },
    { kind: 'feature' as const, text: 'c' }
  ]
}

describe('groupEntries', () => {
  it('separa novidades e correções mantendo a ordem', () => {
    expect(groupEntries(release)).toEqual({
      features: ['a', 'c'],
      fixes: ['b']
    })
  })
})

describe('formatReleaseDate', () => {
  it('formata em pt-BR', () => {
    expect(formatReleaseDate('2026-10-24T15:00:00Z')).toBe('24 de outubro de 2026')
  })
  it('data inválida vira vazio', () => {
    expect(formatReleaseDate('nada')).toBe('')
  })
})
