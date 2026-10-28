import { fireEvent, render, screen } from '@testing-library/react-native'
import { useAuthStore } from '../../auth/store/authStore'
import { UserPanel } from './UserPanel'

jest.mock('expo-secure-store')

const user = { id: 'u1', username: 'ana_mobile', display_name: 'Ana Mobile', email: 'a@b.co' }

describe('UserPanel', () => {
  beforeEach(() => useAuthStore.setState({ ...useAuthStore.getInitialState(), user }))

  it('mostra o nome, o usuário, o microfone e o fone', async () => {
    await render(<UserPanel onOpenSettings={() => {}} />)
    expect(screen.getByText('Ana Mobile')).toBeOnTheScreen()
    expect(screen.getByText('@ana_mobile')).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: 'Silenciar microfone' })).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: 'Ensurdecer' })).toBeOnTheScreen()
  })

  it('a engrenagem abre as configurações', async () => {
    const onOpenSettings = jest.fn()
    await render(<UserPanel onOpenSettings={onOpenSettings} />)
    await fireEvent.press(screen.getByRole('button', { name: 'Configurações' }))
    expect(onOpenSettings).toHaveBeenCalled()
  })

  it('sem usuário carregado ainda: não quebra e mantém os botões', async () => {
    useAuthStore.setState({ user: null })
    await render(<UserPanel onOpenSettings={() => {}} />)
    expect(screen.getByRole('button', { name: 'Configurações' })).toBeOnTheScreen()
  })
})
