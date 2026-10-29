import { describe, expect, it } from 'vitest'
import { chooseOverlayRenderer, overlayRendererFlag } from './overlayRenderer'

describe('overlayRendererFlag', () => {
  it('lê --overlay=<x> do argv ou SALINHA_OVERLAY', () => {
    expect(overlayRendererFlag(['app', '--overlay=electron'], {})).toBe('electron')
    expect(overlayRendererFlag(['app'], { SALINHA_OVERLAY: 'native' })).toBe('native')
    expect(overlayRendererFlag(['app'], { SALINHA_OVERLAY: ' Electron ' })).toBe('electron')
  })

  it('argv vence a variável; valor desconhecido ou ausente = sem preferência', () => {
    expect(overlayRendererFlag(['--overlay=native'], { SALINHA_OVERLAY: 'electron' })).toBe('native')
    expect(overlayRendererFlag(['--overlay=dx12'], {})).toBeNull()
    expect(overlayRendererFlag([], { SALINHA_OVERLAY: '' })).toBeNull()
    expect(overlayRendererFlag([], {})).toBeNull()
  })
})

describe('chooseOverlayRenderer', () => {
  const win = { platform: 'win32' as const, helperExists: true, forced: null, nativeFailed: false }

  it('Windows com o helper: janela nativa', () => {
    expect(chooseOverlayRenderer(win)).toBe('native')
    expect(chooseOverlayRenderer({ ...win, forced: 'native' })).toBe('native')
  })

  it('forçar o antigo (comparação) usa o Electron', () => {
    expect(chooseOverlayRenderer({ ...win, forced: 'electron' })).toBe('electron')
  })

  it('sem o helper ou depois de o nativo falhar: Electron', () => {
    expect(chooseOverlayRenderer({ ...win, helperExists: false })).toBe('electron')
    expect(chooseOverlayRenderer({ ...win, nativeFailed: true, forced: 'native' })).toBe('electron')
  })

  it('Linux e macOS continuam no Electron', () => {
    expect(chooseOverlayRenderer({ ...win, platform: 'linux' })).toBe('electron')
    expect(chooseOverlayRenderer({ ...win, platform: 'darwin', forced: 'native' })).toBe('electron')
  })
})
