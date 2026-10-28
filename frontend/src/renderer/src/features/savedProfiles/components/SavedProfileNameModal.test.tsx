import { describe, expect, it, vi } from 'vitest'

// Sem DOM: o Modal vira uma caixa com o título.
vi.mock('../../../shared/ui/Modal', () => ({
  default: ({ title, children }: { title: string; children: React.ReactNode }) => (
    <div role="dialog" data-title={title}>
      {children}
    </div>
  )
}))

import { renderToStaticMarkup } from 'react-dom/server'
import type { SavedProfile } from '../lib/savedProfiles'
import SavedProfileNameModal from './SavedProfileNameModal'

const item: SavedProfile = {
  id: 'a',
  name: 'Casual',
  fields: { display_name: 'Ana' },
  avatar_url: null,
  banner_url: null,
  created_at: '',
  updated_at: ''
}

const render = (props: Partial<Parameters<typeof SavedProfileNameModal>[0]> = {}): string =>
  renderToStaticMarkup(
    <SavedProfileNameModal
      title="Salvar perfil atual"
      submitLabel="Salvar"
      initialName="Perfil 1"
      list={[item]}
      busy={false}
      onSubmit={async () => true}
      onClose={() => {}}
      {...props}
    />
  )

describe('SavedProfileNameModal', () => {
  it('campo com o nome sugerido, Cancelar e o botão de enviar', () => {
    const html = render()
    expect(html).toContain('data-title="Salvar perfil atual"')
    expect(html).toContain('Nome do perfil')
    expect(html).toContain('value="Perfil 1"')
    expect(html).toContain('Cancelar')
    expect(html).toMatch(/<button[^>]*type="submit"[^>]*>Salvar<\/button>/)
    // O erro só aparece depois de mexer no campo.
    expect(html).not.toContain('aria-invalid')
  })

  it('em andamento, os botões travam', () => {
    const html = render({ busy: true })
    expect(html).toMatch(/<button(?=[^>]*type="submit")[^>]*disabled=""/)
    expect(html).toMatch(/<button(?=[^>]*type="button")[^>]*disabled=""[^>]*>Cancelar/)
  })
})
