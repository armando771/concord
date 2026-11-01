import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import ContextSubmenu from './ContextSubmenu'

describe('ContextSubmenu', () => {
  const html = renderToStaticMarkup(
    <ContextSubmenu label="Mover para" triggerClass="item">
      <button role="menuitem">Canal 1</button>
    </ContextSubmenu>
  )

  it('renderiza só o item pai, fechado e com os atributos de menu', () => {
    expect(html).toContain('Mover para')
    expect(html).toContain('role="menuitem"')
    expect(html).toContain('aria-haspopup="menu"')
    expect(html).toContain('aria-expanded="false"')
  })

  it('não monta o painel enquanto fechado (nem os itens dele)', () => {
    expect(html).not.toContain('Canal 1')
    expect(html.match(/role="menu"/g)).toBeNull()
  })
})
