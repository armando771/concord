import { beforeEach, describe, expect, it, vi } from 'vitest'

// Sem DOM: o portal vira o próprio conteúdo.
vi.mock('react-dom', async (original) => ({
  ...(await original<typeof import('react-dom')>()),
  createPortal: (node: React.ReactNode) => node
}))

import { renderToStaticMarkup } from 'react-dom/server'
import Modal from './Modal'

describe('Modal', () => {
  beforeEach(() => {
    vi.stubGlobal('document', { body: {} })
  })

  it('fechado, não renderiza nada', () => {
    expect(renderToStaticMarkup(<Modal open={false}>x</Modal>)).toBe('')
  })

  it('aberto, é um diálogo com título e conteúdo', () => {
    const html = renderToStaticMarkup(
      <Modal open title="Apagar canal" onClose={() => {}}>
        <p>conteúdo</p>
      </Modal>
    )
    expect(html).toContain('role="dialog"')
    expect(html).toContain('aria-modal="true"')
    expect(html).toContain('Apagar canal')
    expect(html).toContain('conteúdo')
  })

  it('só tem o botão ✕ quando dá para fechar', () => {
    expect(renderToStaticMarkup(<Modal open onClose={() => {}} />)).toContain('aria-label="Fechar"')
    expect(renderToStaticMarkup(<Modal open />)).not.toContain('aria-label="Fechar"')
  })

  it('a largura segue wide e xl', () => {
    expect(renderToStaticMarkup(<Modal open />)).toContain('max-w-md')
    expect(renderToStaticMarkup(<Modal open wide />)).toContain('max-w-3xl')
    expect(renderToStaticMarkup(<Modal open xl />)).toContain('max-w-5xl')
  })
})
