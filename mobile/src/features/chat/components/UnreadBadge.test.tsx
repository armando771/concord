import { render, screen } from '@testing-library/react-native'
import { UnreadBadge, UnreadDot } from './UnreadBadge'

describe('UnreadBadge', () => {
  it('mostra o número e o rótulo para leitor de tela', async () => {
    await render(<UnreadBadge count={3} />)
    expect(screen.getByLabelText('3 mensagens não lidas')).toBeOnTheScreen()
    expect(screen.getByText('3')).toBeOnTheScreen()
  })

  it('1 mensagem: singular; mais de 99: 99+', async () => {
    const { rerender } = await render(<UnreadBadge count={1} />)
    expect(screen.getByLabelText('1 mensagem não lida')).toBeOnTheScreen()
    await rerender(<UnreadBadge count={250} />)
    expect(screen.getByText('99+')).toBeOnTheScreen()
  })

  it('sem não lidas não desenha nada', async () => {
    await render(<UnreadBadge count={0} />)
    expect(screen.queryByText('0')).toBeNull()
    expect(screen.queryByLabelText(/não lida/)).toBeNull()
  })
})

describe('UnreadDot', () => {
  it('ponto de "mensagens não lidas" (servidor e canal)', async () => {
    await render(<UnreadDot />)
    expect(screen.getByLabelText('Mensagens não lidas')).toBeOnTheScreen()
  })
})
