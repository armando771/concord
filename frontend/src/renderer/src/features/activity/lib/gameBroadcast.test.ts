import { describe, expect, it, vi } from 'vitest'
import {
  WINDOW_NOT_FOUND,
  broadcastTone,
  broadcastView,
  canBroadcastGame,
  toggleGameBroadcast,
  type GameBroadcastDeps
} from './gameBroadcast'

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

describe('broadcastView', () => {
  const base = { game: 'Fortnite', sharing: false, canStream: true, connected: true, broadcasting: null }

  it('ocioso: convida a transmitir', () => {
    expect(broadcastView(base)).toEqual({ active: false, disabled: false, label: 'Transmitir Fortnite' })
  })

  it('ativo só se o compartilhamento é deste jogo', () => {
    expect(broadcastView({ ...base, sharing: true, broadcasting: 'Fortnite' }).active).toBe(true)
    expect(broadcastView({ ...base, sharing: true, broadcasting: 'Outro' }).active).toBe(false)
    expect(broadcastView({ ...base, sharing: false, broadcasting: 'Fortnite' }).active).toBe(false)
  })

  it('desabilita fora da call ativa ou sem permissão de transmitir', () => {
    expect(broadcastView({ ...base, connected: false }).disabled).toBe(true)
    expect(broadcastView({ ...base, canStream: false }).disabled).toBe(true)
    // Já transmitindo, dá para parar mesmo sem permissão.
    expect(broadcastView({ ...base, canStream: false, sharing: true }).disabled).toBe(false)
  })

  it('cada estado tem a sua cor', () => {
    const tone = (o: object): string => broadcastTone(broadcastView({ ...base, ...o }))
    expect(tone({ connected: false })).toContain('cursor-not-allowed')
    expect(tone({ sharing: true, broadcasting: 'Fortnite' })).toContain('bg-success-strong')
    expect(tone({})).toContain('hover:bg-fg/12')
  })
})

describe('canBroadcastGame', () => {
  it('só com a API do desktop', () => {
    expect(canBroadcastGame(undefined)).toBe(false)
    expect(canBroadcastGame({ api: {} })).toBe(false)
    expect(canBroadcastGame({ api: { screenShare: { preferGameWindow: () => null } } })).toBe(true)
  })
})
