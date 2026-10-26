import { describe, expect, it, vi } from 'vitest'
import { WINDOW_NOT_FOUND, toggleGameBroadcast, type GameBroadcastDeps } from './gameBroadcast'

function deps(over: Partial<GameBroadcastDeps> = {}): GameBroadcastDeps {
  return {
    game: 'Fortnite',
    sharing: false,
    active: false,
    prefer: vi.fn().mockResolvedValue('window:1:0'),
    notePicked: vi.fn(),
    start: vi.fn().mockResolvedValue(undefined),
    stop: vi.fn(),
    isSharing: () => true,
    remember: vi.fn(),
    notify: vi.fn(),
    ...over
  }
}

describe('toggleGameBroadcast', () => {
  it('um clique inicia o compartilhamento da janela do jogo', async () => {
    const d = deps()
    await toggleGameBroadcast(d)
    expect(d.notePicked).toHaveBeenCalledWith('window:1:0')
    expect(d.start).toHaveBeenCalledTimes(1)
    expect(d.remember).toHaveBeenCalledWith('Fortnite')
    expect(d.notify).not.toHaveBeenCalled()
  })

  it('clicar de novo encerra, sem reiniciar', async () => {
    const d = deps({ sharing: true, active: true })
    await toggleGameBroadcast(d)
    expect(d.stop).toHaveBeenCalled()
    expect(d.start).not.toHaveBeenCalled()
  })

  it('janela indisponível: avisa e deixa escolher outra pelo seletor', async () => {
    const d = deps({ prefer: vi.fn().mockResolvedValue(null) })
    await toggleGameBroadcast(d)
    expect(d.notify).toHaveBeenCalledWith(WINDOW_NOT_FOUND('Fortnite'))
    expect(d.notePicked).not.toHaveBeenCalled()
    expect(d.start).toHaveBeenCalledTimes(1)
  })

  it('compartilhando outra coisa: troca pela janela do jogo', async () => {
    const d = deps({ sharing: true, active: false })
    await toggleGameBroadcast(d)
    expect(d.stop).toHaveBeenCalled()
    expect(d.start).toHaveBeenCalled()
  })

  it('cancelou o seletor: não marca como transmissão do jogo', async () => {
    const d = deps({ isSharing: () => false })
    await toggleGameBroadcast(d)
    expect(d.remember).not.toHaveBeenCalled()
  })
})
