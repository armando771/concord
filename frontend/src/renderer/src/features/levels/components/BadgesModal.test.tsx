import { beforeEach, describe, expect, it, vi } from 'vitest'

const store = vi.hoisted(() => ({
  modal: { userId: 'u1', name: 'Ana', avatarUrl: null } as unknown,
  byUser: {} as Record<string, unknown>
}))
vi.mock('../store/badgeStore', () => ({
  useBadgeStore: (select: (s: unknown) => unknown) =>
    select({
      modal: store.modal,
      byUser: store.byUser,
      closeModal: () => {},
      openModal: () => {}
    })
}))
vi.mock('../../auth/store/authStore', () => ({
  useAuthStore: (select: (s: unknown) => unknown) => select({ user: { id: 'me' } })
}))
vi.mock('../../../shared/ui/Avatar', () => ({ default: () => <i /> }))
// Sem DOM: o portal vira o próprio conteúdo.
vi.mock('react-dom', async (original) => ({
  ...(await original<typeof import('react-dom')>()),
  createPortal: (node: React.ReactNode) => node
}))

import { renderToStaticMarkup } from 'react-dom/server'
import BadgesModal from './BadgesModal'

describe('BadgesModal', () => {
  beforeEach(() => {
    vi.stubGlobal('document', { body: {} })
    store.modal = { userId: 'u1', name: 'Ana', avatarUrl: null }
  })

  it('aberto, mostra a coluna de badges e o detalhe, com o botão de fechar', () => {
    const html = renderToStaticMarkup(<BadgesModal />)
    expect(html).toContain('role="dialog"')
    expect(html).toContain('Badges de Ana')
    expect(html).toContain('aria-label="Fechar"')
  })

  it('sem modal aberto não renderiza nada', () => {
    store.modal = null
    expect(renderToStaticMarkup(<BadgesModal />)).toBe('')
  })

  it('em tela estreita empilha a grade e o detalhe (antes o detalhe ficava com ~40 px)', () => {
    const html = renderToStaticMarkup(<BadgesModal />)
    expect(html).toMatch(/role="dialog"[^>]*class="[^"]*[\s"]flex-col[\s"]/)
    expect(html).toContain('md:flex-row')
  })

  it('a coluna de 290 px só existe a partir de md, e empilhada não passa de metade da altura', () => {
    const html = renderToStaticMarkup(<BadgesModal />)
    expect(html).toContain('md:w-[290px]')
    expect(html).not.toMatch(/[\s"]w-\[290px\]/)
    expect(html).toContain('max-h-[50%]')
  })
})
