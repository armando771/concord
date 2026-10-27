import { describe, expect, it, vi } from 'vitest'

// O som de entrada puxa a call/rede; tem teste próprio.
vi.mock('../../../profile/components/EntranceSoundSettings', () => ({ default: () => null }))
vi.mock('../../../profile/components/ProfileCardBody', () => ({ default: () => null }))

import { renderToStaticMarkup } from 'react-dom/server'
import type { ProfileEditor } from '../../hooks/useProfileEditor'
import { draftFromProfile } from '../../../profile/lib/profileValidation'
import AppearanceTab from './AppearanceTab'
import IdentityTab from './IdentityTab'
import ProfileEditorTabs from './ProfileEditorTabs'
import ProfilePreviewPanel from './ProfilePreviewPanel'

const editor = (over: Partial<ProfileEditor> = {}): ProfileEditor =>
  ({
    user: { id: 'u', username: 'ana', email: 'a@x', display_name: 'Ana' },
    draft: draftFromProfile({ display_name: 'Ana' }),
    errors: {},
    set: () => {},
    setMedia: () => {},
    ...over
  }) as unknown as ProfileEditor

describe('abas do editor', () => {
  it('a escolhida fica selecionada e focável', () => {
    const html = renderToStaticMarkup(
      <ProfileEditorTabs value="appearance" alert={null} onChange={() => {}} />
    )
    expect(html).toMatch(/aria-selected="true"[^>]*tabindex="0"[^>]*>Aparência/)
    expect(html).toMatch(/aria-selected="false"[^>]*tabindex="-1"[^>]*>Identidade/)
  })
  it('Aparência mostra o tema e o estilo do nome, que abre o modal', () => {
    const html = renderToStaticMarkup(<AppearanceTab editor={editor()} onEditName={() => {}} />)
    expect(html).toContain('Predefinições')
    expect(html).toContain('Estilo do nome')
    expect(html).toContain('Mudar estilo')
    expect(html).toContain('Ana')
  })
  it('Aparência sem nome mostra o @', () => {
    const html = renderToStaticMarkup(
      <AppearanceTab
        editor={editor({ draft: draftFromProfile({ display_name: ' ' }) })}
        onEditName={() => {}}
      />
    )
    expect(html).toContain('ana')
  })
  it('Identidade sem avatar mostra a inicial; sem nome, a do @', () => {
    const html = renderToStaticMarkup(
      <IdentityTab
        editor={editor({ draft: draftFromProfile({ display_name: '' }) })}
        avatarUrl={null}
        bannerUrl="/b.png"
        onPick={() => {}}
      />
    )
    expect(html).toContain('>A</span>')
    expect(html).toContain('src="/b.png"')
    expect(html).toContain('Remover banner')
    // Nome, pronomes e aniversário saíram daqui (cartão e Minha conta).
    expect(html).not.toContain('Pronomes')
    expect(html).not.toContain('Aniversário')
    expect(html).not.toContain('salvam na hora')
  })
})

describe('ProfilePreviewPanel', () => {
  it('começa aberta, com o botão de recolher no celular', () => {
    const html = renderToStaticMarkup(
      <ProfilePreviewPanel
        user={{ id: 'u', username: 'ana', email: 'a@x', display_name: 'Ana' } as never}
        draft={draftFromProfile({ display_name: 'Ana' })}
        avatarUrl={null}
        bannerUrl={null}
        onEdit={() => {}}
      />
    )
    expect(html).toContain('aria-expanded="true"')
    expect(html).toContain('Recolher')
    expect(html).toContain('qualquer parte do cartão')
    expect(html).not.toContain('role="alert"')
  })
  it('mostra o aviso de erro do nome/pronomes', () => {
    const html = renderToStaticMarkup(
      <ProfilePreviewPanel
        user={{ id: 'u', username: 'ana', email: 'a@x', display_name: 'Ana' } as never}
        draft={draftFromProfile({ display_name: 'Ana' })}
        avatarUrl={null}
        bannerUrl={null}
        notice="corrija o nome"
      />
    )
    expect(html).toContain('role="alert"')
    expect(html).toContain('corrija o nome')
  })
})
