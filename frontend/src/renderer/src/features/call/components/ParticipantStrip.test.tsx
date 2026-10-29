import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import ParticipantStrip from './ParticipantStrip'

const render = (hidden: boolean): string =>
  renderToStaticMarkup(
    <ParticipantStrip hidden={hidden} onToggle={() => {}}>
      <span>Ana</span>
    </ParticipantStrip>
  )

describe('ParticipantStrip', () => {
  it('visível: mostra os participantes e oferece ocultar', () => {
    const html = render(false)
    expect(html).toContain('aria-label="Ocultar participantes"')
    expect(html).toContain('aria-expanded="true"')
    expect(html).toContain('Ana')
    expect(html).not.toContain('inert')
  })

  it('oculta: oferece mostrar e deixa a faixa inerte, sem desmontar', () => {
    const html = render(true)
    expect(html).toContain('aria-label="Mostrar participantes"')
    expect(html).toContain('aria-expanded="false"')
    // Segue montada (o áudio das transmissões da faixa não pode cortar).
    expect(html).toContain('Ana')
    expect(html).toContain('inert')
  })

  it('a animação respeita prefers-reduced-motion', () => {
    expect(render(true)).toContain('motion-reduce:transition-none')
  })
})
