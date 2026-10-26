import { describe, expect, it } from 'vitest'
import { PreferredSource, exeProcessNames, pickGameWindow } from './gameWindow'

const win = (hwnd: number, name: string): { id: string; name: string } => ({
  id: `window:${hwnd}:0`,
  name
})

describe('exeProcessNames', () => {
  it('devolve os executáveis do catálogo sem o .exe', () => {
    expect(exeProcessNames('Apex Legends')).toEqual(['r5apex', 'r5apex_dx12'])
  })

  it('jogo fora do catálogo não tem executável conhecido', () => {
    expect(exeProcessNames('Jogo Qualquer')).toEqual([])
  })
})

describe('pickGameWindow', () => {
  const sources = [win(10, 'Discord'), win(20, 'Counter-Strike 2'), win(30, 'Bloco de notas')]

  it('prefere a janela do processo do jogo', () => {
    expect(pickGameWindow(sources, ['30'], 'Counter-Strike 2')).toBe('window:30:0')
  })

  it('sem processo com janela, cai para o título que traz o nome do jogo', () => {
    expect(pickGameWindow(sources, [], 'counter-strike 2')).toBe('window:20:0')
  })

  it('ignora telas inteiras e devolve null se nada combina', () => {
    const only = [{ id: 'screen:0:0', name: 'Counter-Strike 2' }]
    expect(pickGameWindow(only, [], 'Counter-Strike 2')).toBeNull()
    expect(pickGameWindow(sources, [], 'Outro')).toBeNull()
  })
})

describe('PreferredSource', () => {
  it('vale uma única vez', () => {
    const preferred = new PreferredSource(() => 0)
    preferred.set('window:1:0')
    expect(preferred.take()).toBe('window:1:0')
    expect(preferred.take()).toBeNull()
  })

  it('expira se ninguém pediu a captura a tempo', () => {
    let now = 0
    const preferred = new PreferredSource(() => now)
    preferred.set('window:1:0')
    now = 60_000
    expect(preferred.take()).toBeNull()
  })

  it('clear descarta', () => {
    const preferred = new PreferredSource(() => 0)
    preferred.set('window:1:0')
    preferred.clear()
    expect(preferred.take()).toBeNull()
  })
})
