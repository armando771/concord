import { describe, expect, it, vi } from 'vitest'

// Sem DOM: o Modal vira uma caixa com o título; o cartão, só o que ele recebe.
vi.mock('../../../../../shared/ui/Modal', () => ({
  default: ({ title, children, xl }: { title: string; children: React.ReactNode; xl?: boolean }) => (
    <div role="dialog" data-title={title} data-xl={String(Boolean(xl))}>
      {children}
    </div>
  )
}))
vi.mock('../../../../profile/components/ProfileCardBody', () => ({
  default: ({ profile }: { profile: { display_name: string; pronouns: string } }) => (
    <div data-card={profile.display_name} data-pronouns={profile.pronouns} />
  )
}))
vi.mock('../../../../../shared/ui/Avatar', () => ({ default: () => <span data-avatar /> }))

import { renderToStaticMarkup } from 'react-dom/server'
import { draftFromProfile } from '../../../../profile/lib/profileValidation'
import EditModalShell from './EditModalShell'
import FieldModal from './FieldModal'
import NameStyleModal from './NameStyleModal'
import ProfileSpotModal, { applyPatch } from './ProfileSpotModal'
import { SPOT_FIELDS } from './spotFields'

const user = { id: 'u1', username: 'ana', email: 'a@x', display_name: 'Ana' } as never
const base = { user, avatarUrl: null, bannerUrl: null }
const draft = draftFromProfile({ display_name: 'Ana', pronouns: 'ela/dela' })
const noop = (): void => {}

describe('EditModalShell', () => {
  it('controles, prévia e os botões; a ação extra fica à esquerda', () => {
    const html = renderToStaticMarkup(
      <EditModalShell
        title="T"
        onClose={noop}
        onApply={noop}
        canApply
        extraAction={<i>extra</i>}
        preview={<i>prévia</i>}
      >
        <i>campos</i>
      </EditModalShell>
    )
    expect(html).toContain('data-title="T"')
    expect(html).toContain('<i>campos</i>')
    expect(html).toContain('aria-label="Prévia"')
    expect(html).toContain('<i>extra</i>')
    expect(html).toContain('Cancelar')
    expect(html).toContain('>Aplicar<')
  })
  it('salvando: "Salvando…" e botões travados', () => {
    const html = renderToStaticMarkup(
      <EditModalShell title="T" onClose={noop} onApply={noop} canApply busy preview={null}>
        x
      </EditModalShell>
    )
    expect(html).toContain('Salvando…')
    expect(html.match(/disabled=""/g)?.length).toBe(2)
  })
})

describe('NameStyleModal', () => {
  it('nome, estilo, Surpreenda-me e as duas prévias (cartão e chat)', () => {
    const html = renderToStaticMarkup(
      <NameStyleModal base={base} draft={draft} onClose={noop} onApply={noop} />
    )
    expect(html).toContain('data-title="Nome de exibição"')
    expect(html).toContain('data-xl="true"')
    expect(html).toContain('aria-label="Nome de exibição"')
    expect(html).toContain('Fonte')
    expect(html).toContain('Efeito')
    expect(html).toContain('Surpreenda-me')
    expect(html).toContain('data-card="Ana"')
    expect(html).toContain('No chat')
  })
  it('nome inválido trava o Aplicar', () => {
    const html = renderToStaticMarkup(
      <NameStyleModal
        base={base}
        draft={{ ...draft, display_name: ' ' }}
        onClose={noop}
        onApply={noop}
      />
    )
    expect(html).toMatch(/type="submit" disabled=""/)
    // A prévia usa o @ enquanto não há nome.
    expect(html).toContain('data-card="ana"')
  })
})

describe('FieldModal', () => {
  it('pronomes: o campo e o cartão ao vivo', () => {
    const html = renderToStaticMarkup(
      <FieldModal field={SPOT_FIELDS.pronouns} base={base} draft={draft} onClose={noop} onApply={noop} />
    )
    expect(html).toContain('data-title="Pronomes"')
    expect(html).toContain('value="ela/dela"')
    expect(html).toContain('data-pronouns="ela/dela"')
  })
  it('cada parte tem o campo dela', () => {
    const fields = { note: 'Nota', bio: 'Sobre mim', links: 'Links' } as const
    for (const [spot, title] of Object.entries(fields)) {
      const html = renderToStaticMarkup(
        <FieldModal
          field={SPOT_FIELDS[spot as keyof typeof fields]}
          base={base}
          draft={draft}
          onClose={noop}
          onApply={noop}
        />
      )
      expect(html).toContain(`data-title="${title}"`)
    }
  })
  it('valor inválido trava o Aplicar', () => {
    const html = renderToStaticMarkup(
      <FieldModal
        field={SPOT_FIELDS.pronouns}
        base={base}
        draft={{ ...draft, pronouns: 'x'.repeat(50) }}
        onClose={noop}
        onApply={noop}
      />
    )
    expect(html).toMatch(/type="submit" disabled=""/)
  })
})

describe('ProfileSpotModal', () => {
  const editor = { draft, set: noop }
  const render = (spot: Parameters<typeof ProfileSpotModal>[0]['spot']): string =>
    renderToStaticMarkup(<ProfileSpotModal spot={spot} base={base} editor={editor} onClose={noop} />)

  it('nada aberto, avatar ou banner: sem modal', () => {
    expect(render(null)).toBe('')
    expect(render('avatar')).toBe('')
    expect(render('banner')).toBe('')
  })
  it('o nome abre o modal do nome; o resto, o do campo', () => {
    expect(render('name')).toContain('Surpreenda-me')
    expect(render('bio')).toContain('data-title="Sobre mim"')
  })
  it('Aplicar passa cada campo para o rascunho', () => {
    const set = vi.fn()
    applyPatch(set, { display_name: 'Aninha', pronouns: 'ela' })
    expect(set).toHaveBeenCalledWith('display_name', 'Aninha')
    expect(set).toHaveBeenCalledWith('pronouns', 'ela')
  })
})
