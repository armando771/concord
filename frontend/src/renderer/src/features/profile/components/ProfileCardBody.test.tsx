import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

// Atividade (presença), avatar e nome ao vivo vêm de stores: aqui ficam fixos.
const activity = vi.hoisted(() => ({ game: null as Record<string, unknown> | null }))
vi.mock('../../activity/store/presenceActivityStore', () => ({ useActivity: () => activity.game }))
vi.mock('../../activity/components/GameIcon', () => ({ default: () => <i data-game-icon /> }))
vi.mock('../../activity/components/ActivityCard', () => ({ Elapsed: () => <i>há 5 min</i> }))
vi.mock('../../../shared/ui/Avatar', () => ({
  default: ({ name }: { name: string }) => <span data-avatar={name} />
}))
vi.mock('./StyledName', () => ({ default: ({ name }: { name: string }) => <b>{name}</b> }))
vi.mock('../../../assets/maestro-banner.gif', () => ({ default: 'maestro.gif' }))

import { MAESTRO_USER_ID } from '../../music/lib/music'
import ProfileCardBody, { type CardProfile } from './ProfileCardBody'

const base: CardProfile = { id: 'u1', display_name: 'Ana', username: 'ana' }
const render = (props: Partial<React.ComponentProps<typeof ProfileCardBody>> = {}): string =>
  renderToStaticMarkup(<ProfileCardBody profile={base} fallbackBanner="linear-gradient(red, blue)" {...props} />)

describe('ProfileCardBody', () => {
  it('sem banner usa o degradê padrão e mostra nome e @', () => {
    const html = render()
    expect(html).toContain('linear-gradient(red, blue)')
    expect(html).toContain('<b>Ana</b>')
    expect(html).toContain('<span>ana</span>')
    expect(html).not.toContain('<img')
  })

  it('banner com imagem; com cor, a cor', () => {
    expect(render({ profile: { ...base, banner_url: 'https://x/b.png' } })).toContain('src="https://x/b.png"')
    expect(render({ profile: { ...base, banner_color: '#112233' } })).toContain('background:#112233')
  })

  it('o Maestro tem o banner animado e o passo a passo', () => {
    const html = render({ profile: { ...base, id: MAESTRO_USER_ID, is_bot: true } })
    expect(html).toContain('src="maestro.gif"')
    expect(html).toContain('>Bot<')
    expect(html).toContain('<ol')
  })

  it('carregando: skeleton no banner e na bio', () => {
    const html = render({ loading: true })
    expect(html.match(/class="skeleton/g)?.length).toBe(3)
  })

  it('apelido em destaque com o nome de verdade embaixo', () => {
    const html = render({ profile: { ...base, nickname: 'Aninha' } })
    expect(html).toContain('Aninha')
    expect(html).toContain('title="Nome de exibição (fora deste servidor)"')
  })

  it('pronomes, nota, bio com link e links do perfil', () => {
    const html = render({
      profile: {
        ...base,
        pronouns: 'ela/dela',
        status_text: 'jogando',
        bio: 'veja https://ana.dev',
        links: ['https://github.com/ana']
      }
    })
    expect(html).toContain(' • ')
    expect(html).toContain('ela/dela')
    expect(html).toContain('jogando')
    expect(html).toContain('href="https://ana.dev"')
    expect(html).toContain('href="https://github.com/ana"')
  })

  it('jogando agora aparece fora da prévia', () => {
    activity.game = { name: 'Celeste', started_at: 1 }
    const html = render()
    activity.game = null
    expect(html).toContain('Jogando agora')
    expect(html).toContain('Celeste')
  })

  it('o próprio perfil: (você), editar e adicionar nota', () => {
    const html = render({ isMe: true, onEditProfile: () => {} })
    expect(html).toContain('(você)')
    expect(html).toContain('aria-label="Editar perfil"')
    expect(html).toContain('Adicionar uma nota')
  })

  it('prévia do editor: lápis no avatar e no banner, sem (você)', () => {
    const html = render({ isMe: true, preview: true, onEditAvatar: () => {}, onEditBanner: () => {} })
    expect(html).toContain('aria-label="Alterar avatar"')
    expect(html).toContain('aria-label="Alterar banner"')
    expect(html).not.toContain('(você)')
  })

  it('selo e badges ao lado', () => {
    const html = render({ badge: <i>nivel</i>, badges: <i>badges</i> })
    expect(html).toContain('<i>nivel</i>')
    expect(html).toContain('<i>badges</i>')
  })
})
