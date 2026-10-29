import { fireEvent, render, screen } from '@testing-library/react-native'
import { useIncomingCallStore } from '../store/incomingCallStore'
import { IncomingCallScreen } from './IncomingCallScreen'

beforeEach(() => useIncomingCallStore.getState().clear())

describe('IncomingCallScreen', () => {
  it('sem chamada tocando não mostra nada', async () => {
    await render(<IncomingCallScreen onAccept={jest.fn()} onDecline={jest.fn()} />)
    expect(screen.queryByText('Atender')).toBeNull()
  })

  it('mostra quem liga e chama atender ou recusar', async () => {
    useIncomingCallStore.getState().ring({ callId: 'c1', conversationId: 'cv', initiator: { id: 'u1', username: 'ana', display_name: 'Ana' } })
    const onAccept = jest.fn()
    const onDecline = jest.fn()
    await render(<IncomingCallScreen onAccept={onAccept} onDecline={onDecline} />)
    expect(screen.getByText('Ana')).toBeOnTheScreen()
    expect(screen.getByText('Está te ligando')).toBeOnTheScreen()
    await fireEvent.press(screen.getByRole('button', { name: 'Atender' }))
    await fireEvent.press(screen.getByRole('button', { name: 'Recusar' }))
    expect(onAccept).toHaveBeenCalled()
    expect(onDecline).toHaveBeenCalled()
  })
})
