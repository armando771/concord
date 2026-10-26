import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import JumpToPresentButton from './JumpToPresentButton'

const render = (visible: boolean, newCount: number): string =>
  renderToStaticMarkup(
    <JumpToPresentButton visible={visible} newCount={newCount} onClick={() => {}} />
  )

describe('JumpToPresentButton', () => {
  it('é um botão com nome acessível', () => {
    const html = render(true, 0)
    expect(html).toContain('<button')
    expect(html).toContain('type="button"')
    expect(html).toContain('aria-label="Voltar às mensagens recentes"')
  })

  it('visível: aparece e recebe clique/foco', () => {
    const html = render(true, 0)
    expect(html).toContain('opacity-100')
    expect(html).not.toContain('invisible')
  })

  it('escondido: some da tela e do foco (sem hover/tab), mas continua no DOM para a transição', () => {
    const html = render(false, 0)
    expect(html).toContain('invisible')
    expect(html).toContain('opacity-0')
    expect(html).toContain('pointer-events-none')
  })

  it('alvo de toque de pelo menos 40 px', () => {
    expect(render(true, 0)).toContain('size-10')
  })

  it('respeita prefers-reduced-motion', () => {
    expect(render(true, 0)).toContain('motion-reduce:transition-none')
  })

  it('sem novas: sem selo', () => {
    expect(render(true, 0)).not.toContain('data-new-count')
  })

  it('com novas: selo com a contagem e rótulo com ela', () => {
    const html = render(true, 3)
    expect(html).toContain('data-new-count')
    expect(html).toContain('>3<')
    expect(html).toContain('aria-label="Voltar às mensagens recentes, 3 novas"')
  })

  it('contagem alta vira 99+', () => {
    expect(render(true, 250)).toContain('>99+<')
  })
})
