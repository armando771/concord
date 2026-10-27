import { describe, expect, it, vi } from 'vitest'

// Sem DOM: o portal vira o próprio conteúdo.
vi.mock('react-dom', async (original) => ({
  ...(await original<typeof import('react-dom')>()),
  createPortal: (node: React.ReactNode) => node
}))

import { renderToStaticMarkup } from 'react-dom/server'
import SettingsShell from './SettingsShell'

function render(): string {
  vi.stubGlobal('document', { body: {} })
  return renderToStaticMarkup(
    <SettingsShell
      ariaLabel="Configurações"
      nav={<p>menu</p>}
      title="Minha conta"
      titleClassName="text-xl"
      contentClassName="max-w-[740px]"
      closeLabel="Fechar configurações"
      onClose={() => {}}
      overlay={<p>confirmação</p>}
    >
      <p>conteúdo</p>
    </SettingsShell>
  )
}

describe('SettingsShell', () => {
  it('mostra navegação, título, conteúdo e o que vem por cima', () => {
    const html = render()
    for (const text of ['menu', 'Minha conta', 'conteúdo', 'confirmação']) {
      expect(html).toContain(text)
    }
    expect(html).toContain('aria-label="Fechar configurações"')
  })

  it('em tela estreita empilha: navegação em cima, conteúdo embaixo', () => {
    const html = render()
    expect(html).toMatch(/class="[^"]*[\s"]flex-col[\s"]/)
    expect(html).toContain('md:flex-row')
  })

  it('a navegação só tem 260 px de coluna a partir de md (antes comia 260 de 360 px)', () => {
    const html = render()
    expect(html).toContain('md:w-[260px]')
    expect(html).not.toMatch(/[\s"]w-\[260px\]/)
  })

  it('no celular abre na lista de seções (a seção some até escolher)', () => {
    const html = render()
    expect(html).toMatch(/<main class="[^"]*max-md:hidden/)
    expect(html).not.toMatch(/<aside[^>]*max-md:hidden/)
  })

  it('a seção tem "voltar" para a lista, só no celular', () => {
    expect(render()).toMatch(/md:hidden[^"]*">.*Configurações<\/button>/)
  })

  it('o conteúdo tem margem pequena em tela estreita', () => {
    const html = render()
    expect(html).toContain('px-4')
    expect(html).toContain('sm:px-10')
  })

  it('o ✕ fica no canto (right-3) em tela estreita e só vai para right-8 em md', () => {
    const html = render()
    expect(html).toContain('right-3')
    expect(html).toContain('md:right-8')
  })

  it('o aviso ESC só aparece onde há teclado (md)', () => {
    expect(render()).toMatch(/hidden[^"]*md:block[^"]*">ESC</)
  })
})
