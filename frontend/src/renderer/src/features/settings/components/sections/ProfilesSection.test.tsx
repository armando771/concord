import { beforeEach, describe, expect, it, vi } from 'vitest'

// No render de servidor o zustand devolve o estado inicial; os mocks deixam
// cada teste escolher o usuário.
const state = vi.hoisted(() => ({
  auth: {
    user: null as Record<string, unknown> | null,
    setUser: vi.fn()
  },
  settings: { setDirty: vi.fn(), blockedAt: 0 }
}))
vi.mock('../../../auth/store/authStore', () => ({
  useAuthStore: Object.assign((sel: (s: typeof state.auth) => unknown) => sel(state.auth), {
    getState: () => state.auth
  })
}))
vi.mock('../../store/settingsStore', () => ({
  useSettingsStore: (sel: (s: typeof state.settings) => unknown) => sel(state.settings)
}))

vi.mock('../../../profile/components/EntranceSoundSettings', () => ({ default: () => null }))
// O corpo do cartão puxa a atividade (e a call); aqui basta o que a prévia recebe.
vi.mock('../../../profile/components/ProfileCardBody', () => ({
  default: ({ profile }: { profile: { display_name: string; links: string[] } }) => (
    <div data-preview={profile.display_name}>{profile.links.join(' ')}</div>
  )
}))

import { renderToStaticMarkup } from 'react-dom/server'
import ProfilesSection from './ProfilesSection'

const render = (): string => renderToStaticMarkup(<ProfilesSection />)

beforeEach(() => {
  state.auth.user = {
    id: 'u1',
    username: 'ana',
    display_name: 'Ana',
    email: 'a@x.com',
    bio: 'oi',
    links: [{ url: 'https://github.com/ana' }],
    banner_color: '#112233',
    avatar_url: '/a.png',
    banner_url: '/b.png',
    status: 'online'
  }
})

describe('ProfilesSection', () => {
  it('sem usuário não desenha nada', () => {
    state.auth.user = null
    expect(render()).toBe('')
  })

  it('abre em Identidade, com as abas e a prévia', () => {
    const html = render()
    expect(html).toContain('role="tablist"')
    expect(html).toContain('Identidade')
    expect(html).toContain('Aparência')
    expect(html).toContain('Prévia do cartão')
    expect(html).toContain('data-preview="Ana"')
    // Nome e pronomes se editam no cartão; o aniversário, em Minha conta.
    expect(html).not.toContain('Estes dois salvam na hora')
    expect(html).not.toContain('Aniversário')
    expect(html).toContain('qualquer parte do cartão')
    expect(html).toContain('Sobre mim')
    expect(html).toContain('Remover avatar')
    expect(html).toContain('Remover banner')
    expect(html).toContain('Usar a cor padrão')
    expect(html).toContain('https://github.com/ana')
    // Sem alterações, sem a barra de aviso.
    expect(html).not.toContain('alterações não salvas')
    expect(html).not.toContain('tem campo com erro')
  })

  it('campo com erro marca a aba Identidade', () => {
    state.auth.user = { ...state.auth.user, bio: 'x'.repeat(300) }
    expect(render()).toContain('tem campo com erro')
  })

  it('erro no nome avisa embaixo do cartão, não na aba', () => {
    state.auth.user = { ...state.auth.user, display_name: '' }
    const html = render()
    expect(html).toContain('clique neles no cartão')
    expect(html).not.toContain('tem campo com erro')
  })

  it('nenhum modal começa aberto', () => {
    expect(render()).not.toContain('role="dialog"')
  })

  it('sem avatar, banner nem cor: sem os botões de remover', () => {
    state.auth.user = { ...state.auth.user, avatar_url: null, banner_url: null, banner_color: null }
    const html = render()
    expect(html).not.toContain('Remover avatar')
    expect(html).not.toContain('Remover banner')
    expect(html).not.toContain('Usar a cor padrão')
  })
})
