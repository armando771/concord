import { fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import { useAuthStore } from '../../auth/store/authStore'
import { getProfile } from '../api/users'
import { useProfileCardStore } from '../store/profileCardStore'
import { ProfileScreen } from './ProfileScreen'

jest.mock('expo-secure-store')
jest.mock('../api/users')

const getProfileMock = jest.mocked(getProfile)

describe('ProfileScreen', () => {
  beforeEach(() => {
    jest.clearAllMocks()
    useAuthStore.setState(useAuthStore.getInitialState(), true)
    useProfileCardStore.getState().reset()
  })

  it('carregando: indicador e botão Voltar', async () => {
    getProfileMock.mockReturnValue(new Promise(() => {}))
    const onBack = jest.fn()
    await render(<ProfileScreen userId="u2" onBack={onBack} />)
    expect(screen.getByTestId('profile-loading')).toBeOnTheScreen()
    await fireEvent.press(screen.getByRole('button', { name: 'Voltar' }))
    expect(onBack).toHaveBeenCalled()
  })

  it('pronto: mostra o cartão da pessoa', async () => {
    getProfileMock.mockResolvedValue({ id: 'u2', username: 'ana', display_name: 'Ana', bio: 'oi' })
    await render(<ProfileScreen userId="u2" onBack={jest.fn()} />)
    expect(await screen.findByText('@ana')).toBeOnTheScreen()
    expect(screen.getByText('Sobre mim')).toBeOnTheScreen()
  })

  // Review Focus 1: perfil que não existe.
  it('404: mensagem de erro, Voltar e tentar de novo, sem travar', async () => {
    getProfileMock.mockRejectedValueOnce(Object.assign(new Error('x'), { status: 404 }))
    getProfileMock.mockResolvedValueOnce({ id: 'u9', username: 'zed', display_name: 'Zed' })
    const onBack = jest.fn()
    await render(<ProfileScreen userId="u9" onBack={onBack} />)
    expect(await screen.findByText('Não foi possível abrir esse perfil.')).toBeOnTheScreen()
    expect(screen.getByRole('button', { name: 'Voltar' })).toBeOnTheScreen()
    await fireEvent.press(screen.getByRole('button', { name: 'Tentar de novo' }))
    await waitFor(() => expect(screen.getByText('@zed')).toBeOnTheScreen())
    expect(screen.queryByText('Não foi possível abrir esse perfil.')).toBeNull()
  })

  it('o próprio perfil abre na hora, da sessão', async () => {
    useAuthStore.setState({ user: { id: 'u1', username: 'eu', display_name: 'Eu', email: 'e@x.co' } })
    await render(<ProfileScreen userId="u1" onBack={jest.fn()} />)
    expect(screen.getByText('@eu')).toBeOnTheScreen()
    expect(getProfileMock).not.toHaveBeenCalled()
  })
})
