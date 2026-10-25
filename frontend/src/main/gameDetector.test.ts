import { describe, expect, it } from 'vitest'
import { nextGame, parseTasklist } from './gameDetector'

describe('parseTasklist', () => {
  it('lê o nome do executável de cada linha csv', () => {
    const out =
      '"System Idle Process","0","Services","0","8 K"\r\n"cs2.exe","1234","Console","1","900 K"\r\n'
    expect(parseTasklist(out)).toEqual(['System Idle Process', 'cs2.exe'])
  })

  it('ignora linhas que não são csv', () => {
    expect(parseTasklist('INFO: nenhuma tarefa\n\n')).toEqual([])
  })
})

describe('nextGame', () => {
  it('começa a contar quando o jogo aparece', () => {
    expect(nextGame(null, ['chrome.exe', 'cs2.exe'], 100)).toEqual({
      name: 'Counter-Strike 2',
      startedAt: 100
    })
  })

  it('mantém o início enquanto é o mesmo jogo', () => {
    const before = { name: 'Counter-Strike 2', startedAt: 100 }
    expect(nextGame(before, ['cs2.exe'], 999)).toBe(before)
  })

  it('troca de jogo com início novo', () => {
    const before = { name: 'Counter-Strike 2', startedAt: 100 }
    expect(nextGame(before, ['tslgame.exe'], 500)).toEqual({
      name: 'PUBG: BATTLEGROUNDS',
      startedAt: 500
    })
  })

  it('some quando o jogo fecha', () => {
    expect(nextGame({ name: 'Counter-Strike 2', startedAt: 100 }, ['chrome.exe'], 900)).toBeNull()
  })
})
