import { describe, expect, it } from 'vitest'
import { GAMES, detectGame, gameAccent, gameForExe } from './gameCatalog'

describe('gameCatalog', () => {
  it('reconhece o executável sem diferenciar maiúsculas', () => {
    expect(gameForExe('VALORANT-Win64-Shipping.exe')?.name).toBe('VALORANT')
    expect(gameForExe(' TslGame.exe ')?.name).toBe('PUBG: BATTLEGROUNDS')
  })

  it('ignora processo fora do catálogo', () => {
    expect(gameForExe('notepad.exe')).toBeUndefined()
    expect(detectGame(['explorer.exe', 'chrome.exe'])).toBeUndefined()
  })

  it('devolve o primeiro jogo encontrado', () => {
    expect(detectGame(['chrome.exe', 'cs2.exe', 'tslgame.exe'])?.name).toBe('Counter-Strike 2')
  })

  it('não repete executável entre jogos', () => {
    const exes = GAMES.flatMap((game) => game.exes)
    expect(new Set(exes).size).toBe(exes.length)
    expect(exes.every((exe) => exe === exe.toLowerCase())).toBe(true)
  })

  it('devolve a cor pelo nome', () => {
    expect(gameAccent('VALORANT')).toBe('#fd4556')
    expect(gameAccent('Outro')).toBeUndefined()
  })
})
