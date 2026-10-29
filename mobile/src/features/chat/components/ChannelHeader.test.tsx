import { fireEvent, render, screen } from '@testing-library/react-native'
import { ChannelHeader } from './ChannelHeader'

describe('ChannelHeader', () => {
  it('mostra o nome do canal com #', async () => {
    await render(<ChannelHeader name="chat-dos-brothers" onBack={() => {}} />)
    expect(screen.getByText('chat-dos-brothers')).toBeOnTheScreen()
  })

  it('conversa 1 a 1 usa @ e grupo não usa prefixo', async () => {
    const { rerender } = await render(<ChannelHeader name="Paulo" prefix="@" onBack={() => {}} />)
    expect(screen.getByText('@')).toBeOnTheScreen()
    await rerender(<ChannelHeader name="DEVS" prefix="" onBack={() => {}} />)
    expect(screen.queryByText('#')).toBeNull()
    expect(screen.queryByText('@')).toBeNull()
  })

  it('voltar chama onBack', async () => {
    const onBack = jest.fn()
    await render(<ChannelHeader name="geral" onBack={onBack} />)
    await fireEvent.press(screen.getByRole('button', { name: 'Voltar' }))
    expect(onBack).toHaveBeenCalled()
  })
})
