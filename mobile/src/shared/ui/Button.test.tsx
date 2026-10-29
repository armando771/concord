import { fireEvent, render, screen } from '@testing-library/react-native'
import { Button } from './Button'

describe('Button', () => {
  it('chama onPress ao tocar', async () => {
    const onPress = jest.fn()
    await render(<Button title="Entrar" onPress={onPress} />)
    await fireEvent.press(screen.getByRole('button', { name: 'Entrar' }))
    expect(onPress).toHaveBeenCalledTimes(1)
  })

  it('enviando (loading): desativado e não chama onPress', async () => {
    const onPress = jest.fn()
    await render(<Button title="Entrar" onPress={onPress} loading />)
    const button = screen.getByRole('button', { name: 'Entrar' })
    expect(button).toBeDisabled()
    await fireEvent.press(button)
    expect(onPress).not.toHaveBeenCalled()
  })

  it('desativado não chama onPress', async () => {
    const onPress = jest.fn()
    await render(<Button title="Entrar" onPress={onPress} disabled />)
    await fireEvent.press(screen.getByRole('button', { name: 'Entrar' }))
    expect(onPress).not.toHaveBeenCalled()
  })
})
