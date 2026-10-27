import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { MAESTRO_HOWTO, MAESTRO_USER_ID } from '../../music/lib/music'

// No render de servidor o zustand devolveria o estado inicial: os stores do
// perfil e a atividade são trocados por versões fixas.
vi.mock('../../../assets/nameStyle.css', () => ({}))
vi.mock('../store/profileStore', () => ({
  useProfileStore: (select: (s: { profiles: Record<string, unknown> }) => unknown) =>
    select({ profiles: {} }),
  useUserLook: (_id: string | undefined, fallback: unknown) => fallback
}))
vi.mock('../../activity/components/ProfileActivities', () => ({
  ProfileActivities: ({ userId }: { userId?: string }) => <i data-activity={userId ?? 'none'} />
}))

import ProfileCardBody, { type CardProfile } from './ProfileCardBody'

const ana: CardProfile = {
  id: 'u1',
  display_name: 'Ana',
  username: 'ana',
  pronouns: 'ela/dela',
  bio: 'Oi! Veja https://exemplo.com',
  status_text: '  ouvindo bossa nova  ',
  links: ['https://github.com/ana'],
  banner_color: '#123456'
}

const render = (props: Partial<React.ComponentProps<typeof ProfileCardBody>> = {}): string =>
  renderToStaticMarkup(<ProfileCardBody profile={ana} fallbackBanner="linear-gradient(red, blue)" {...props} />)

describe('ProfileCardBody', () => {
  it('mostra nome, @usuário, pronomes, nota, Sobre mim com link e os links', () => {
    const html = render()
    expect(html).toContain('Ana')
    expect(html).toContain('<span>ana</span>')
    expect(html).toContain('ela/dela')
    expect(html).toContain('ouvindo bossa nova')
    expect(html).toContain('href="https://exemplo.com"')
    expect(html).toContain('href="https://github.com/ana"')
    expect(html).toContain('background:#123456')
    expect(html).toContain('data-activity="u1"')
  })

  it('apelido em destaque com o nome de exibição embaixo; "(você)" fora da prévia', () => {
    const html = render({ profile: { ...ana, nickname: 'Aninha' }, isMe: true })
    expect(html).toContain('Aninha')
    expect(html).toContain('Nome de exibição (fora deste servidor)')
    expect(html).toContain('(você)')
    expect(render({ isMe: true, preview: true })).not.toContain('(você)')
  })

  it('prévia do editor: lápis no banner e no avatar, sem atividade', () => {
    const html = render({ preview: true, onEditAvatar: () => {}, onEditBanner: () => {} })
    expect(html).toContain('Alterar banner')
    expect(html).toContain('Alterar avatar')
    expect(html).toContain('data-activity="none"')
  })

  it('próprio perfil sem nota oferece adicionar uma', () => {
    const html = render({ profile: { ...ana, status_text: '' }, isMe: true, onEditProfile: () => {} })
    expect(html).toContain('Adicionar uma nota')
    expect(html).toContain('Editar perfil')
    expect(render({ profile: { ...ana, status_text: '' } })).not.toContain('Adicionar uma nota')
  })

  it('carregando: banner e Sobre mim em skeleton; sem cor, o gradiente padrão', () => {
    const html = render({ profile: { id: 'u1', display_name: 'Ana' }, loading: true, badge: <b>7</b> })
    expect(html.match(/class="skeleton/g)?.length).toBeGreaterThanOrEqual(3)
    expect(html).toContain('<b>7</b>')
    expect(render({ profile: { id: 'u1', display_name: 'Ana' } })).toContain('linear-gradient(red, blue)')
  })

  it('Maestro: banner animado, selo BOT e o passo a passo', () => {
    const html = render({ profile: { id: MAESTRO_USER_ID, display_name: 'Maestro', username: 'maestro', is_bot: true } })
    expect(html).toContain('<img')
    expect(html).toContain('Bot')
    expect(html).toContain(MAESTRO_HOWTO.title)
  })
})
