import { fireEvent, render, screen } from '@testing-library/react-native'
import { ConversationRow } from './ConversationRow'

describe('ConversationRow', () => {
  it('sem foto: a inicial do nome no avatar', async () => {
    await render(<ConversationRow title="Bia Web" onPress={() => {}} />)
    expect(screen.getByText('B')).toBeOnTheScreen()
  })

  // Regressão: a linha "Amigos" do painel de DMs mostrava uma bolinha com a letra "A".
  it('com ícone: não desenha a inicial (é um atalho, não uma pessoa)', async () => {
    await render(<ConversationRow title="Amigos" icon="people" onPress={() => {}} />)
    expect(screen.queryByText('A')).toBeNull()
    expect(screen.getByRole('button', { name: 'Amigos' })).toBeOnTheScreen()
  })

  it('tocar chama onPress', async () => {
    const onPress = jest.fn()
    await render(<ConversationRow title="Amigos" icon="people" onPress={onPress} />)
    await fireEvent.press(screen.getByRole('button', { name: 'Amigos' }))
    expect(onPress).toHaveBeenCalled()
  })

  it('selo de não lidas à direita', async () => {
    await render(<ConversationRow title="Bia Web" unread={3} onPress={() => {}} />)
    expect(screen.getByLabelText('3 mensagens não lidas')).toBeOnTheScreen()
  })
})
