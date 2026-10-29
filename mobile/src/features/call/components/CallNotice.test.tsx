import { fireEvent, render, screen } from '@testing-library/react-native'
import { useCallNoticeStore } from '../store/callNoticeStore'
import { CallNotice } from './CallNotice'

beforeEach(() => useCallNoticeStore.getState().dismiss())

describe('CallNotice', () => {
  it('não mostra nada sem aviso', async () => {
    await render(<CallNotice />)
    expect(screen.queryByRole('alert')).toBeNull()
  })

  it('mostra o aviso e some ao tocar em Fechar', async () => {
    useCallNoticeStore.getState().show('Sala trancada. Peça para alguém abrir.')
    await render(<CallNotice />)
    expect(screen.getByText('Sala trancada. Peça para alguém abrir.')).toBeOnTheScreen()
    await fireEvent.press(screen.getByRole('button', { name: 'Fechar aviso' }))
    expect(useCallNoticeStore.getState().message).toBeNull()
  })

  it('aviso de microfone negado oferece abrir as configurações', async () => {
    const openSettings = jest.fn()
    useCallNoticeStore.getState().show('Sem permissão do microfone. Você entrou mudo.')
    await render(<CallNotice onOpenSettings={openSettings} />)
    await fireEvent.press(screen.getByRole('button', { name: 'Abrir configurações' }))
    expect(openSettings).toHaveBeenCalled()
  })
})
