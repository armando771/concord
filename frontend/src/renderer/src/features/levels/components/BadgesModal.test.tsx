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
    store.byUser = {}
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

  describe('badge do segundo turno (v22)', () => {
    const v22 = {
      category: 'v22',
      name: 'Fez o 22',
      description: 'Fez o 22 no segundo turno.',
      unit: 'vote',
      value: 1,
      tier: 1,
      tier_name: 'Fez o 22',
      rarity: 'lendario',
      unlocked_at: '2026-10-27T12:00:00Z',
      tiers: [
        { tier: 1, name: 'Fez o 22', threshold: 1, rarity: 'lendario', unlocked_at: '2026-10-27' }
      ]
    }

    it('no perfil de outra pessoa diz 22, não L', () => {
      store.byUser = { u1: { badges: [v22] } }
      const html = renderToStaticMarkup(<BadgesModal />)
      expect(html).toContain('Fez o 22 no segundo turno')
      expect(html).not.toContain('Fez o L')
    })

    it('no próprio perfil mostra o progresso e a escada com 22', () => {
      store.modal = { userId: 'me', name: 'Eu', avatarUrl: null }
      store.byUser = { me: { badges: [v22] } }
      const html = renderToStaticMarkup(<BadgesModal />)
      expect(html).toContain('Seu progresso')
      expect(html).toContain('Fez o 22 no segundo turno')
      expect(html).not.toContain('Fez o L')
    })
  })
})
