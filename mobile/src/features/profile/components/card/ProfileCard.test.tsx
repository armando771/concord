import { fireEvent, render, screen } from '@testing-library/react-native'
import { colors } from '../../../../shared/theme/tokens'
import type { ProfileData } from '../../lib/profileTypes'
import { ProfileCard } from './ProfileCard'

const FULL: ProfileData = {
  id: 'u1',
  username: 'ana',
  display_name: 'Ana',
  pronouns: 'ela/dela',
  status_text: 'codando',
  bio: 'Oi, sou a Ana. Veja https://github.com/ana.',
  links: [{ url: 'https://github.com/ana' }, { url: 'https://www.twitch.tv/ana' }],
  banner_color: '#112233',
  name_style: { font: 'default', effect: 'solid', colors: ['#00ffaa'] },
  profile_theme: { background: 'solid', background_colors: ['#1e1b4b'], border: 'neon', border_colors: ['#ec4899'], border_width: 3 }
}

describe('ProfileCard', () => {
  it('perfil completo: nome, usuário, pronomes, status, Sobre mim e Links', async () => {
    await render(<ProfileCard profile={FULL} status="online" />)
    expect(screen.getByText('Ana')).toBeOnTheScreen()
    expect(screen.getByText('@ana')).toBeOnTheScreen()
    expect(screen.getByText('ela/dela')).toBeOnTheScreen()
    expect(screen.getByText('codando')).toBeOnTheScreen()
    expect(screen.getByText('Sobre mim')).toBeOnTheScreen()
    expect(screen.getByText('Links')).toBeOnTheScreen()
    expect(screen.getByRole('link', { name: 'twitch.tv/ana' })).toBeOnTheScreen()
    expect(screen.getByLabelText('Online')).toBeOnTheScreen()
  })

  it('o tema aplica fundo e borda no cartão', async () => {
    await render(<ProfileCard profile={FULL} />)
    expect(screen.getByTestId('profile-card')).toHaveStyle({
      backgroundColor: '#1e1b4b',
      borderColor: '#ec4899',
      borderWidth: 3
    })
  })

  it('link dentro do Sobre mim é tocável e a pontuação fica de fora', async () => {
    const onOpenLink = jest.fn()
    await render(<ProfileCard profile={FULL} onOpenLink={onOpenLink} />)
    await fireEvent.press(screen.getByText('https://github.com/ana'))
    expect(onOpenLink).toHaveBeenCalledWith('https://github.com/ana')
  })

  // Review Focus 3: perfil sem nada além do básico.
  it('perfil mínimo: iniciais, fundo do app, sem seções vazias', async () => {
    await render(<ProfileCard profile={{ id: 'u2', username: 'bia', display_name: 'Bia' }} />)
    expect(screen.getByText('B')).toBeOnTheScreen()
    expect(screen.getByTestId('profile-card')).toHaveStyle({ backgroundColor: colors.bgFloating })
    expect(screen.getByTestId('card-banner-color')).toHaveStyle({ backgroundColor: colors.brand })
    expect(screen.queryByText('Sobre mim')).toBeNull()
    expect(screen.queryByText('Links')).toBeNull()
  })

  it('bio só com espaços não cria a seção', async () => {
    await render(<ProfileCard profile={{ id: 'u3', username: 'c', display_name: 'C', bio: '   ', links: [] }} />)
    expect(screen.queryByText('Sobre mim')).toBeNull()
  })

  it('tema e estilo inválidos vindos do servidor não derrubam o cartão', async () => {
    const bad = { ...FULL, profile_theme: { border: 'x', background: 'y', effect: 'z' }, name_style: { font: 1 as never, effect: null as never } }
    await render(<ProfileCard profile={bad} />)
    expect(screen.getByText('Ana')).toBeOnTheScreen()
  })

  it('fica centrado com no máximo 480 dp (telas largas)', async () => {
    await render(<ProfileCard profile={FULL} />)
    expect(screen.getByTestId('profile-card')).toHaveStyle({ width: '100%', maxWidth: 480, alignSelf: 'center' })
  })
})
