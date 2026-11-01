import { render, screen } from '@testing-library/react-native'
import { Avatar } from './Avatar'

describe('Avatar', () => {
  it('sem foto: mostra a inicial do nome', async () => {
    await render(<Avatar name="ana mobile" size={40} />)
    expect(screen.getByText('A')).toBeOnTheScreen()
  })

  it('com foto: mostra a imagem com o endereço resolvido', async () => {
    await render(<Avatar name="Ana" uri="/api/media/a.png" size={40} />)
    const image = screen.getByLabelText('Foto de Ana')
    expect(image.props.source).toEqual({ uri: 'http://localhost:8080/api/media/a.png' })
  })

  it('GIF animado fica parado por padrão (listas) e anima com animated', async () => {
    await render(<Avatar name="Ana" uri="/api/profile-media/a_1" size={40} />)
    expect(screen.getByLabelText('Foto de Ana').props.source).toEqual({ uri: 'http://localhost:8080/api/profile-media/a_1/static' })
    await render(<Avatar name="Bia" uri="/api/profile-media/a_2" size={40} animated />)
    expect(screen.getByLabelText('Foto de Bia').props.source).toEqual({ uri: 'http://localhost:8080/api/profile-media/a_2' })
  })

  it('nome vazio não quebra', async () => {
    await render(<Avatar name="" size={40} />)
    expect(screen.getByText('?')).toBeOnTheScreen()
  })
})
