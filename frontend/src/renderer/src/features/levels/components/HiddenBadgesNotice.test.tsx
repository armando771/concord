import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import HiddenBadgesNotice from './HiddenBadgesNotice'

const render = (count: number | undefined): string =>
  renderToStaticMarkup(<HiddenBadgesNotice count={count} />)

describe('HiddenBadgesNotice', () => {
  it('plural, com o "?" e a dica', () => {
    const html = render(12)
    expect(html).toContain('12 badges ocultos restantes')
    expect(html).toContain('>?<')
    expect(html).toContain('Os detalhes de cada badge serão revelados quando alcançados')
  })

  it('singular com 1', () => {
    const html = render(1)
    expect(html).toContain('1 badge oculto restante')
    expect(html).not.toContain('badges ocultos')
  })

  it('com 0 (ou sem número) não mostra nada', () => {
    expect(render(0)).toBe('')
    expect(render(undefined)).toBe('')
  })
})
