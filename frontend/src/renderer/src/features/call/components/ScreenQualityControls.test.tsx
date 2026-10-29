import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import ScreenQualityControls from './ScreenQualityControls'
import { ScreenCodecOptions } from './ScreenCodecControl'

const value = { resolution: '1080p', frameRate: 60 } as const

describe('ScreenQualityControls', () => {
  it('resolução e fps escolhidos aparecem pressionados', () => {
    const html = renderToStaticMarkup(<ScreenQualityControls value={value} onChange={() => {}} />)
    expect(html).toMatch(/aria-pressed="true"[^>]*>1080p</)
    expect(html).toMatch(/aria-pressed="true"[^>]*>60 FPS</)
    expect(html).toContain('Fonte mantém a resolução original')
  })

  it('tem Avançado com o codec (Automático por padrão), também no painel da chamada', () => {
    for (const compact of [false, true]) {
      const html = renderToStaticMarkup(
        <ScreenQualityControls compact={compact} value={value} onChange={() => {}} />
      )
      expect(html).toContain('<summary')
      expect(html).toContain('Avançado')
      expect(html).toMatch(/aria-pressed="true"[^>]*>Automático</)
    }
  })
})

describe('ScreenCodecOptions', () => {
  it('VP8 escolhido; no modal explica o automático', () => {
    const html = renderToStaticMarkup(
      <ScreenCodecOptions value="vp8" onChange={() => {}} compact={false} />
    )
    expect(html).toMatch(/aria-pressed="true"[^>]*>VP8</)
    expect(html).toMatch(/aria-pressed="false"[^>]*>Automático</)
    expect(html).toContain('Automático usa H.264')
  })

  it('durante a live avisa que vale na próxima transmissão', () => {
    const html = renderToStaticMarkup(
      <ScreenCodecOptions value="auto" onChange={() => {}} compact />
    )
    expect(html).toContain('Vale a partir da próxima transmissão.')
  })
})
