import { fireEvent, render, screen } from '@testing-library/react-native'
import { ChannelHeader } from './ChannelHeader'

describe('ChannelHeader', () => {
  it('mostra o nome do canal com #', async () => {
    await render(<ChannelHeader name="chat-dos-brothers" onBack={() => {}} />)
    expect(screen.getByText('chat-dos-brothers')).toBeOnTheScreen()
  })

  it('voltar chama onBack', async () => {
    const onBack = jest.fn()
    await render(<ChannelHeader name="geral" onBack={onBack} />)
    await fireEvent.press(screen.getByRole('button', { name: 'Voltar' }))
    expect(onBack).toHaveBeenCalled()
  })
})
