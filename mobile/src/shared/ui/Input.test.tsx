import { fireEvent, render, screen } from '@testing-library/react-native'
import { Input } from './Input'

describe('Input', () => {
  it('mostra o rótulo e repassa o texto digitado', async () => {
    const onChangeText = jest.fn()
    await render(<Input label="E-mail" value="" onChangeText={onChangeText} />)
    await fireEvent.changeText(screen.getByLabelText('E-mail'), 'a@b.co')
    expect(onChangeText).toHaveBeenCalledWith('a@b.co')
  })

  it('mostra o erro embaixo do campo', async () => {
    await render(<Input label="E-mail" value="x" onChangeText={() => {}} error="Informe um e-mail válido." />)
    expect(screen.getByRole('alert')).toHaveTextContent('Informe um e-mail válido.')
  })

  it('sem erro, não mostra alerta', async () => {
    await render(<Input label="E-mail" value="" onChangeText={() => {}} />)
    expect(screen.queryByRole('alert')).toBeNull()
  })
})
