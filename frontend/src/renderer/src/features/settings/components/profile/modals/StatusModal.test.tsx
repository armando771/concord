import { describe, expect, it, vi } from 'vitest'

vi.mock('../../../../../shared/ui/Modal', () => ({
  default: ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div role="dialog" data-title={title}>
      {children}
    </div>
  )
}))

import { renderToStaticMarkup } from 'react-dom/server'
import StatusModal from './StatusModal'

describe('StatusModal', () => {
  it('renderiza as opções de status com rótulos e descrição do modo invisível', () => {
    const html = renderToStaticMarkup(
      <StatusModal status="online" onClose={() => {}} onSelect={() => {}} />
    )

    expect(html).toContain('data-title="Status"')
    expect(html).toContain('Online')
    expect(html).toContain('Ausente')
    expect(html).toContain('Não perturbe')
    expect(html).toContain('Invisível')
    expect(html).toContain('Você aparecerá offline, mas terá acesso total ao Salinha')
  })

  it('marca a opção atualmente selecionada', () => {
    const html = renderToStaticMarkup(
      <StatusModal status="invisible" onClose={() => {}} onSelect={() => {}} />
    )

    expect(html).toContain('aria-checked="true"')
  })
})
