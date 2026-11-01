import { fireEvent, render, screen } from '@testing-library/react-native'
import { colors } from '../../../../shared/theme/tokens'
import { cardLook } from '../../lib/cardLook'
import { CardAvatar } from './CardAvatar'
import { CardBanner } from './CardBanner'
import { CardLinks } from './CardLinks'
import { CardNames } from './CardNames'

const LOOK = cardLook(null)

describe('CardBanner', () => {
  it('com imagem: mostra a imagem do servidor (GIF anima)', async () => {
    await render(<CardBanner url="/api/profile-media/a_1" color={null} />)
    expect(screen.getByTestId('card-banner-image').props.source).toEqual({
      uri: 'http://localhost:8080/api/profile-media/a_1'
    })
  })

  it('sem imagem: usa a cor escolhida', async () => {
    await render(<CardBanner url={null} color="#112233" />)
    expect(screen.getByTestId('card-banner-color')).toHaveStyle({ backgroundColor: '#112233' })
  })

  it('sem nada ou com cor inválida: cor da marca', async () => {
    await render(<CardBanner url={undefined} color="vermelho" />)
    expect(screen.getByTestId('card-banner-color')).toHaveStyle({ backgroundColor: colors.brand })
  })

  it('imagem que falha ao carregar cai na cor', async () => {
    await render(<CardBanner url="/api/profile-media/x" color="#112233" />)
    await fireEvent(screen.getByTestId('card-banner-image'), 'error')
    expect(screen.getByTestId('card-banner-color')).toHaveStyle({ backgroundColor: '#112233' })
  })
})

describe('CardAvatar', () => {
  it('sem foto: inicial do nome; com status: bolinha de presença', async () => {
    await render(<CardAvatar name="Ana" uri={null} status="online" cutout="#123456" />)
    expect(screen.getByText('A')).toBeOnTheScreen()
    expect(screen.getByLabelText('Online')).toBeOnTheScreen()
  })

  it('sem status conhecido: sem bolinha', async () => {
    await render(<CardAvatar name="Ana" uri={null} status={undefined} cutout="#123456" />)
    expect(screen.queryByLabelText('Offline')).toBeNull()
  })

  it('GIF anima no cartão', async () => {
    await render(<CardAvatar name="Ana" uri="/api/profile-media/a_1" cutout="#123456" />)
    expect(screen.getByLabelText('Foto de Ana').props.source).toEqual({ uri: 'http://localhost:8080/api/profile-media/a_1' })
  })
})

describe('CardNames', () => {
  it('nome, @usuário, pronomes e status', async () => {
    await render(
      <CardNames displayName="Ana" username="ana" nameStyle={null} pronouns="ela/dela" statusText="codando" look={LOOK} />
    )
    expect(screen.getByText('Ana')).toBeOnTheScreen()
    expect(screen.getByText('@ana')).toBeOnTheScreen()
    expect(screen.getByText('ela/dela')).toBeOnTheScreen()
    expect(screen.getByText('codando')).toBeOnTheScreen()
  })

  it('só o essencial: sem pronomes nem status vazios', async () => {
    await render(<CardNames displayName="Ana" username="ana" nameStyle={undefined} pronouns="" statusText="  " look={LOOK} />)
    expect(screen.queryByTestId('card-pronouns')).toBeNull()
    expect(screen.queryByTestId('card-status')).toBeNull()
  })

  it('o nome usa a cor do estilo escolhido', async () => {
    await render(
      <CardNames displayName="Ana" username="ana" nameStyle={{ font: 'default', effect: 'solid', colors: ['#00ffaa'] }} look={LOOK} />
    )
    expect(screen.getByText('Ana')).toHaveStyle({ color: '#00ffaa' })
  })

  it('nome de só um emoji e nome enorme aparecem sem quebrar', async () => {
    await render(<CardNames displayName="🙂" username="a" look={LOOK} />)
    expect(screen.getByText('🙂')).toBeOnTheScreen()
    const long = 'N'.repeat(32)
    await render(<CardNames displayName={long} username="b" look={LOOK} />)
    expect(screen.getByText(long).props.numberOfLines).toBe(2)
  })
})

describe('CardLinks', () => {
  it('cada link mostra domínio e caminho e abre ao tocar', async () => {
    const onOpen = jest.fn()
    await render(<CardLinks links={[{ url: 'https://www.twitch.tv/mugis_rx' }]} look={LOOK} onOpen={onOpen} />)
    await fireEvent.press(screen.getByRole('link', { name: 'twitch.tv/mugis_rx' }))
    expect(onOpen).toHaveBeenCalledWith('https://www.twitch.tv/mugis_rx')
  })

  it('endereço que não é http(s) aparece como texto e não abre nada', async () => {
    const onOpen = jest.fn()
    await render(<CardLinks links={[{ url: 'javascript:alert(1)' }]} look={LOOK} onOpen={onOpen} />)
    expect(screen.queryByRole('link')).toBeNull()
    expect(screen.getByText('javascript:alert(1)')).toBeOnTheScreen()
  })
})
