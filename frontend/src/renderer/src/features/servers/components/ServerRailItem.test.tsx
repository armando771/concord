import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import ServerRailItem from './ServerRailItem'
import type { ServerRailView } from '../lib/serverRailView'

const quiet: ServerRailView = { dimmed: false, badge: 0, voice: null }
const noop = (): void => {}

function render(view: ServerRailView, extra: { iconUrl?: string | null; isActive?: boolean } = {}) {
  return renderToStaticMarkup(
    <ServerRailItem
      name="Brothers"
      isActive={false}
      view={view}
      onOpen={noop}
      onContextMenu={noop}
      {...extra}
    />
  )
}

describe('ServerRailItem', () => {
  it('sem ícone mostra a inicial e o nome acessível, sem title nativo', () => {
    const html = render(quiet)
    expect(html).toContain('>B<')
    expect(html).toContain('aria-label="Brothers"')
    expect(html).not.toContain('title=')
    expect(html).not.toContain('role="tooltip"')
  })

  it('com ícone usa a imagem', () => {
    expect(render(quiet, { iconUrl: 'https://x/y.png' })).toContain('<img')
  })

  it('selo de não lidas, apagado e ativo', () => {
    const html = render({ dimmed: true, badge: 120, voice: null }, { isActive: true })
    expect(html).toContain('99+')
    expect(html).toContain('opacity-50')
    expect(html).toContain('bg-violet-600 text-white')
  })

  it('selo de voz diferencia a minha call da call alheia', () => {
    expect(render({ ...quiet, voice: 'mine' })).toContain('aria-label="Em chamada"')
    expect(render({ ...quiet, voice: 'active' })).toContain('aria-label="Chamada em andamento"')
  })
})
