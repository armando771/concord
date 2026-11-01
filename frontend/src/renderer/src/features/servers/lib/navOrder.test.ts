import { describe, expect, it } from 'vitest'
import { nextTarget } from './navOrder'

const ids = ['a', 'b', 'c', 'd']

describe('nextTarget', () => {
  it('anda para frente e para trás', () => {
    expect(nextTarget(ids, 'b', 1)).toBe('c')
    expect(nextTarget(ids, 'b', -1)).toBe('a')
  })

  it('dá a volta nas pontas', () => {
    expect(nextTarget(ids, 'd', 1)).toBe('a')
    expect(nextTarget(ids, 'a', -1)).toBe('d')
  })

  it('lista vazia não tem destino', () => {
    expect(nextTarget([], 'a', 1)).toBeNull()
  })

  it('item atual fora da lista começa do início (ou do fim, para trás)', () => {
    expect(nextTarget(ids, 'x', 1)).toBe('a')
    expect(nextTarget(ids, 'x', -1)).toBe('d')
    expect(nextTarget(ids, null, 1)).toBe('a')
    expect(nextTarget(ids, null, -1)).toBe('d')
  })

  it('só um item e ele é o atual: sem destino', () => {
    expect(nextTarget(['a'], 'a', 1)).toBeNull()
  })

  describe('só não lidas', () => {
    const unread = (set: string[]) => (id: string) => set.includes(id)

    it('pula quem não tem não lidas', () => {
      expect(nextTarget(ids, 'a', 1, unread(['c']))).toBe('c')
      expect(nextTarget(ids, 'd', -1, unread(['b']))).toBe('b')
    })

    it('dá a volta para achar a não lida', () => {
      expect(nextTarget(ids, 'c', 1, unread(['a']))).toBe('a')
    })

    it('sem nenhuma não lida, null', () => {
      expect(nextTarget(ids, 'a', 1, unread([]))).toBeNull()
    })

    it('a única não lida é a atual: null', () => {
      expect(nextTarget(ids, 'a', 1, unread(['a']))).toBeNull()
    })
  })
})
