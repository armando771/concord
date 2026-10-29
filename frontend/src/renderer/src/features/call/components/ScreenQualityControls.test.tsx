import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import ScreenQualityControls from './ScreenQualityControls'
import { ScreenCodecOptions } from './ScreenCodecControl'
import { ScreenSimulcastOption } from './ScreenSimulcastToggle'

const value = { resolution: '1080p', frameRate: 60 } as const

describe('ScreenQualityControls', () => {
  it('resolução e fps escolhidos aparecem pressionados', () => {
    const html = renderToStaticMarkup(<ScreenQualityControls value={value} onChange={() => {}} />)
    expect(html).toMatch(/aria-pressed="true"[^>]*>1080p</)
    expect(html).toMatch(/aria-pressed="true"[^>]*>60 FPS</)
    expect(html).toContain('Fonte mantém a resolução original, até 1440p')
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
  const placa = { av1: 'software', h265: 'hardware', h264: 'hardware', vp8: 'software' } as const

  it('VP8 escolhido; no modal explica a ordem do automático', () => {
    const html = renderToStaticMarkup(
      <ScreenCodecOptions value="vp8" support={null} onChange={() => {}} compact={false} />
    )
    expect(html).toMatch(/aria-pressed="true"[^>]*>VP8</)
    expect(html).toMatch(/aria-pressed="false"[^>]*>Automático</)
    expect(html).toContain(
      'Automático usa o melhor que a sua placa de vídeo codifica: AV1, depois H.265, depois H.264.'
    )
    for (const label of ['AV1', 'H\\.265', 'H\\.264'])
      expect(html).toMatch(new RegExp(`aria-pressed="false"[^>]*>${label}<`))
  })

  it('codec que a placa não codifica fica desabilitado, com a dica', () => {
    const html = renderToStaticMarkup(
      <ScreenCodecOptions value="auto" support={placa} onChange={() => {}} compact={false} />
    )
    expect(html).toMatch(/disabled=""[^>]*title="Sua placa não codifica"[^>]*>AV1</)
    expect(html).not.toMatch(/disabled=""[^>]*>H\.265</)
    expect(html).toContain('AV1: sua placa não codifica.')
  })

  it('H.264 só pelo processador continua disponível; AV1 e H.265 não', () => {
    const cpu = { av1: null, h265: null, h264: 'software', vp8: 'software' } as const
    const html = renderToStaticMarkup(
      <ScreenCodecOptions value="auto" support={cpu} onChange={() => {}} compact />
    )
    expect(html).toContain('AV1 e H.265: sua placa não codifica.')
    expect(html).not.toMatch(/disabled=""[^>]*>H\.264</)
  })

  it('durante a live avisa que vale na próxima transmissão', () => {
    const html = renderToStaticMarkup(
      <ScreenCodecOptions value="auto" support={null} onChange={() => {}} compact />
    )
    expect(html).toContain('Vale a partir da próxima transmissão.')
  })
})

describe('ScreenSimulcastOption', () => {
  it('Automático por padrão no seletor, com a explicação da placa de vídeo', () => {
    const html = renderToStaticMarkup(<ScreenQualityControls value={value} onChange={() => {}} />)
    expect(html).toContain('Enviar também em 720p para quem tem internet fraca')
    expect(html).toMatch(/aria-pressed="true"[^>]*>Automático<\/button><button[^>]*aria-pressed="false"[^>]*>Ligada</)
    expect(html).toContain('Automático liga quando a sua placa de vídeo aguenta')
    expect(html).toContain('mais pesada para o seu PC')
  })

  it('Desligada escolhida; durante a live avisa que vale na próxima transmissão', () => {
    const html = renderToStaticMarkup(
      <ScreenSimulcastOption value="off" onChange={() => {}} compact />
    )
    expect(html).toMatch(/aria-pressed="true"[^>]*>Desligada</)
    expect(html).toMatch(/aria-pressed="false"[^>]*>Automático</)
    expect(html).toContain('Vale a partir da próxima transmissão.')
  })
})
