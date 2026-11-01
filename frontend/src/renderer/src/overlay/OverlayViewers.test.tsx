import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { OverlayViewers, OverlayWatchingEye } from './OverlayViewers'

describe('OverlayViewers', () => {
  it('sem live (null) não renderiza nada', () => {
    expect(renderToStaticMarkup(<OverlayViewers viewers={null} opacity={30} />)).toBe('')
  })

  it('mostra o olho e o número de espectadores', () => {
    const html = renderToStaticMarkup(<OverlayViewers viewers={3} opacity={30} />)
    expect(html).toContain('<svg')
    expect(html).toContain('>3<')
    expect(html).toContain('3 pessoas assistindo a sua live')
  })

  it('singular e zero', () => {
    expect(renderToStaticMarkup(<OverlayViewers viewers={1} opacity={30} />)).toContain(
      '1 pessoa assistindo a sua live'
    )
    expect(renderToStaticMarkup(<OverlayViewers viewers={0} opacity={30} />)).toContain(
      'Ninguém assistindo a sua live'
    )
  })

  it('respeita a opacidade das pílulas', () => {
    const html = renderToStaticMarkup(<OverlayViewers viewers={2} opacity={40} />)
    expect(html).toContain('opacity:0.4')
  })
})

describe('OverlayWatchingEye', () => {
  it('só aparece em quem assiste', () => {
    expect(renderToStaticMarkup(<OverlayWatchingEye watching={false} />)).toBe('')
    expect(renderToStaticMarkup(<OverlayWatchingEye watching />)).toContain('Assistindo a sua live')
  })
})
