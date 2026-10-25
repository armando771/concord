import { describe, expect, it } from 'vitest'
import { GAMES } from '../../../shared/gameCatalog'
import { gameIconPath } from './gameIcons'

describe('gameIconPath', () => {
  it('jogos com logo devolvem o caminho do SVG', () => {
    expect(gameIconPath('VALORANT')).toMatch(/^M/)
    expect(gameIconPath('Grand Theft Auto V')).toMatch(/^M/)
  })

  it('jogo sem logo ou desconhecido devolve undefined', () => {
    expect(gameIconPath('Minecraft')).toBeUndefined()
    expect(gameIconPath('Jogo Inexistente')).toBeUndefined()
  })

  it('todo logo mapeado pertence a um jogo do catálogo', () => {
    const names = new Set(GAMES.map((g) => g.name))
    const withLogo = [...names].filter((n) => gameIconPath(n))
    expect(withLogo.length).toBe(8)
  })
})
