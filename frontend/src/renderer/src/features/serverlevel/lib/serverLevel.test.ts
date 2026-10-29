import { describe, expect, it } from 'vitest'
import {
  formatXP,
  levelUpMessage,
  parseLevelUp,
  parseProgress,
  serverLevelPercent,
  weekBreakdown
} from './serverLevel'

describe('weekBreakdown', () => {
  it('ordena da fonte que mais rendeu e calcula a parte de cada uma', () => {
    const { rows, total } = weekBreakdown([
      { source: 'membros', xp: 0 },
      { source: 'mensagens', xp: 25 },
      { source: 'voz', xp: 75 }
    ])
    expect(total).toBe(100)
    expect(rows.map((r) => [r.label, r.percent])).toEqual([
      ['Tempo em call', 75],
      ['Mensagens', 25],
      ['Membros novos', 0]
    ])
  })

  it('semana sem XP não divide por zero', () => {
    expect(weekBreakdown([{ source: 'voz', xp: 0 }]).rows[0].percent).toBe(0)
  })

  it('fonte desconhecida aparece com o nome cru', () => {
    expect(weekBreakdown([{ source: 'nova', xp: 1 }]).rows[0].label).toBe('nova')
  })
})

describe('serverLevelPercent', () => {
  it('é a fração do nível atual', () => {
    expect(
      serverLevelPercent({
        server_id: 's',
        level: 2,
        xp: 700,
        xp_into_level: 450,
        xp_for_next: 1000
      })
    ).toBe(45)
  })
})

describe('formatXP', () => {
  it('usa ponto no milhar', () => {
    expect(formatXP(71250)).toBe('71.250')
  })
})

describe('levelUpMessage', () => {
  it('diz o servidor e o nível novo', () => {
    expect(levelUpMessage('Salinha', 3)).toBe('Salinha subiu para o nível 3!')
    expect(levelUpMessage(undefined, 3)).toBe('O servidor subiu para o nível 3!')
  })
})

describe('parseProgress / parseLevelUp', () => {
  it('aceita o payload do backend', () => {
    const p = { server_id: 's', level: 2, xp: 300, xp_into_level: 50, xp_for_next: 1000 }
    expect(parseProgress(p)).toEqual(p)
    expect(parseLevelUp({ server_id: 's', level: 2, previous_level: 1 })).toEqual({
      serverId: 's',
      level: 2
    })
  })

  it('recusa payload torto', () => {
    expect(parseProgress(null)).toBeNull()
    expect(parseProgress({ server_id: 's', level: '2' })).toBeNull()
    expect(parseLevelUp({ level: 2 })).toBeNull()
  })
})
