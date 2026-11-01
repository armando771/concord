import { describe, expect, it } from 'vitest'
import { compareVoiceMembers, sortVoiceMembers, type VoiceMemberKey } from './voiceOrder'

const ids = (list: VoiceMemberKey[]): string[] => list.map((m) => m.id)

describe('compareVoiceMembers', () => {
  it('nível mais alto em cima', () => {
    const list = [
      { id: 'a', name: 'Ana', level: 3 },
      { id: 'b', name: 'Bia', level: 40 },
      { id: 'c', name: 'Caio', level: 12 }
    ]
    expect(ids(sortVoiceMembers(list, (m) => m))).toEqual(['b', 'c', 'a'])
  })

  it('nível ainda não carregado conta como 0', () => {
    const list = [
      { id: 'a', name: 'Ana' },
      { id: 'b', name: 'Bia', level: 1 }
    ]
    expect(ids(sortVoiceMembers(list, (m) => m))).toEqual(['b', 'a'])
  })

  it('empate de nível: quem entrou primeiro', () => {
    const list = [
      { id: 'a', name: 'Ana', level: 5, joinedAt: '2026-10-01T20:05:00Z' },
      { id: 'b', name: 'Bia', level: 5, joinedAt: '2026-10-01T20:01:00Z' }
    ]
    expect(ids(sortVoiceMembers(list, (m) => m))).toEqual(['b', 'a'])
  })

  it('sem horário de entrada: pelo nome (pt-BR), depois pelo id', () => {
    const list = [
      { id: 'z', name: 'Élio', level: 2 },
      { id: 'y', name: 'bruno', level: 2 },
      { id: 'x', name: 'Ana', level: 2 },
      { id: 'w', name: 'Ana', level: 2 }
    ]
    expect(ids(sortVoiceMembers(list, (m) => m))).toEqual(['w', 'x', 'y', 'z'])
  })

  it('sem horário (ou inválido) conta como quem entrou por último', () => {
    const list = [
      { id: 'a', name: 'Caio', level: 1, joinedAt: '2026-10-01T20:00:00Z' },
      { id: 'b', name: 'Bia', level: 1, joinedAt: 'ontem' },
      { id: 'c', name: 'Ana', level: 1 }
    ]
    expect(ids(sortVoiceMembers(list, (m) => m))).toEqual(['a', 'c', 'b'])
  })

  it('ordem total mesmo misturando quem tem e quem não tem horário', () => {
    // Antes: A < B (entrada), B < C (nome), C < A (nome) — um ciclo.
    const list = [
      { id: 'A', name: 'Z', level: 3, joinedAt: '2026-10-01T20:01:00Z' },
      { id: 'B', name: 'A', level: 3, joinedAt: '2026-10-01T20:02:00Z' },
      { id: 'C', name: 'M', level: 3 }
    ]
    const permutations = [
      [0, 1, 2],
      [0, 2, 1],
      [1, 0, 2],
      [1, 2, 0],
      [2, 0, 1],
      [2, 1, 0]
    ]
    for (const order of permutations) {
      expect(
        ids(
          sortVoiceMembers(
            order.map((i) => list[i]),
            (m) => m
          )
        )
      ).toEqual(['A', 'B', 'C'])
    }
    for (const x of list)
      for (const y of list)
        for (const z of list) {
          if (compareVoiceMembers(x, y) < 0 && compareVoiceMembers(y, z) < 0) {
            expect(compareVoiceMembers(x, z)).toBeLessThan(0)
          }
        }
  })

  it('é determinístico: qualquer ordem de entrada dá a mesma saída', () => {
    const list = [
      { id: 'a', name: 'Ana', level: 7, joinedAt: '2026-10-01T20:03:00Z' },
      { id: 'b', name: 'Bia', level: 7, joinedAt: '2026-10-01T20:01:00Z' },
      { id: 'c', name: 'Caio', level: 30 },
      { id: 'd', name: 'Duda' },
      { id: 'e', name: 'Duda' }
    ]
    const want = ['c', 'b', 'a', 'd', 'e']
    expect(ids(sortVoiceMembers(list, (m) => m))).toEqual(want)
    expect(ids(sortVoiceMembers([...list].reverse(), (m) => m))).toEqual(want)
    expect(ids(sortVoiceMembers([list[3], list[0], list[4], list[2], list[1]], (m) => m))).toEqual(
      want
    )
  })

  it('não mexe na lista original', () => {
    const list = [
      { id: 'a', name: 'Ana', level: 1 },
      { id: 'b', name: 'Bia', level: 9 }
    ]
    sortVoiceMembers(list, (m) => m)
    expect(ids(list)).toEqual(['a', 'b'])
  })

  it('comparador puro: simétrico e zero só para a mesma pessoa', () => {
    const a = { id: 'a', name: 'Ana', level: 1 }
    const b = { id: 'b', name: 'Ana', level: 1 }
    expect(compareVoiceMembers(a, b)).toBeLessThan(0)
    expect(compareVoiceMembers(b, a)).toBeGreaterThan(0)
    expect(compareVoiceMembers(a, { ...a })).toBe(0)
  })
})
