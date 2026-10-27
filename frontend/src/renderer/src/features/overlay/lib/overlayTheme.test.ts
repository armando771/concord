import { describe, expect, it } from 'vitest'
import { OVERLAY_THEME_VARS, readOverlayTheme, rgbToHex } from './overlayTheme'

describe('rgbToHex', () => {
  it('converte e encaixa os canais', () => {
    expect(rgbToHex(37, 36, 41)).toBe('#252429')
    expect(rgbToHex(-3, 300, 15.6)).toBe('#00ff10')
  })
})

describe('readOverlayTheme', () => {
  const vars: Record<string, string> = {
    '--bg-floating': ' #252429 ',
    '--text-strong': '#FBFBFB',
    '--text-normal': 'oklch(95% 0 0)',
    '--text-muted': '',
    '--brand': '#5865f2',
    '--green': 'rgb(69, 163, 102)',
    '--color-red-400': 'oklch(70.4% 0.191 22.216)'
  }
  const toHex = (css: string): string | null =>
    css.startsWith('#') ? css : css.startsWith('rgb') ? '#45a366' : css.startsWith('oklch(70') ? '#ff6467' : null

  it('lê cada token e converte para hex; o que não resolve fica de fora', () => {
    expect(readOverlayTheme((name) => vars[name] ?? '', toHex)).toEqual({
      floating: '#252429',
      strong: '#fbfbfb',
      brand: '#5865f2',
      speaking: '#45a366',
      danger: '#ff6467'
    })
  })

  it('conversor que devolve lixo não passa', () => {
    expect(readOverlayTheme(() => '#123', () => 'vermelho')).toBeNull()
  })

  it('sem nenhum token (fora do navegador) é null', () => {
    expect(readOverlayTheme(() => '', toHex)).toBeNull()
  })

  it('usa os mesmos tokens da página do overlay', () => {
    expect(OVERLAY_THEME_VARS.floating).toBe('--bg-floating')
    expect(OVERLAY_THEME_VARS.danger).toBe('--color-red-400')
  })
})
