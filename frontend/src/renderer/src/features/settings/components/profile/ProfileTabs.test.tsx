import { describe, expect, it, vi } from 'vitest'

// O som de entrada e o aniversário puxam a call/rede; têm testes próprios.
vi.mock('../AppSettings', () => ({ BirthdaySettings: () => null }))
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
  it('Aparência mostra o tema e o estilo do nome', () => {
    const html = renderToStaticMarkup(<AppearanceTab editor={editor()} />)
    expect(html).toContain('Predefinições')
    expect(html).toContain('Estilo do nome')
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
        onEditAvatar={() => {}}
        onEditBanner={() => {}}
      />
    )
    expect(html).toContain('aria-expanded="true"')
    expect(html).toContain('Recolher')
  })
})
