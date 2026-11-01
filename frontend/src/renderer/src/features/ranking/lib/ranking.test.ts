import { describe, expect, it } from 'vitest'
import type { MyRank, RankingEntry } from '../api/ranking'
import {
  formatXp,
  isOutsideList,
  myPositionText,
  podiumSlots,
  positionLabel,
  splitRanking
} from './ranking'

const entry = (position: number): RankingEntry => ({
  position,
  user_id: `u${position}`,
  username: `user${position}`,
  display_name: `User ${position}`,
  avatar_url: null,
  name_style: { font: 'default', effect: 'solid', colors: [] },
  level: 10,
  xp: 1000 - position
})
const list = (n: number): RankingEntry[] => Array.from({ length: n }, (_, i) => entry(i + 1))

describe('splitRanking', () => {
  it('separa os 3 primeiros do resto', () => {
    const { podium, rest } = splitRanking(list(5))
    expect(podium.map((e) => e.position)).toEqual([1, 2, 3])
    expect(rest.map((e) => e.position)).toEqual([4, 5])
  })

  it('com menos de 3 pessoas, só há pódio', () => {
    const { podium, rest } = splitRanking(list(2))
    expect(podium).toHaveLength(2)
    expect(rest).toEqual([])
  })
})

describe('podiumSlots', () => {
  it('põe o 1º no meio, entre o 2º e o 3º', () => {
    expect(podiumSlots(list(3)).map((s) => s.entry.position)).toEqual([2, 1, 3])
  })

  it('sem o 3º, mantém 2º e 1º no lugar certo', () => {
    expect(podiumSlots(list(2)).map((s) => s.entry.position)).toEqual([2, 1])
  })

  it('um só: ele no meio', () => {
    expect(podiumSlots(list(1)).map((s) => s.entry.position)).toEqual([1])
  })
})

describe('textos', () => {
  it('positionLabel', () => expect(positionLabel(12)).toBe('#12'))

  it('formatXp usa separador de milhar em português', () => {
    expect(formatXp(12345)).toBe('12.345 XP')
  })

  const me: MyRank = { position: 250, level: 12, xp: 3000 }
  it('myPositionText', () => {
    expect(myPositionText(me)).toBe('Sua posição: #250')
    expect(myPositionText(null)).toBe('Fique em call para entrar no ranking')
  })

  it('isOutsideList: fora da lista mostrada', () => {
    expect(isOutsideList(me, list(100))).toBe(true)
    expect(isOutsideList({ ...me, position: 7 }, list(100))).toBe(false)
    expect(isOutsideList(null, list(100))).toBe(false)
  })
})
