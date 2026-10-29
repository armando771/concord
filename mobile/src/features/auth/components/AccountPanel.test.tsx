import { fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import { useAuthStore } from '../store/authStore'
import { AccountPanel } from './AccountPanel'

jest.mock('../lib/secureTokens')

const user = { id: 'u1', username: 'ana', display_name: 'Ana', email: 'a@b.co' }

describe('AccountPanel', () => {
  beforeEach(() => {
    useAuthStore.setState({ ...useAuthStore.getInitialState(), status: 'signedIn', accessToken: 'a', refreshToken: 'r', user })
  })

  it('mostra o nome e o usuário da conta', async () => {
    await render(<AccountPanel logout={async () => {}} />)
    expect(screen.getByText('Ana')).toBeOnTheScreen()
    expect(screen.getByText('@ana')).toBeOnTheScreen()
  })

  it('Sair avisa o servidor e encerra a sessão local', async () => {
    const logout = jest.fn().mockResolvedValue(undefined)
    await render(<AccountPanel logout={logout} />)
    await fireEvent.press(screen.getByRole('button', { name: 'Sair' }))
    await waitFor(() => expect(useAuthStore.getState().status).toBe('signedOut'))
    expect(logout).toHaveBeenCalled()
  })

  it('Sair encerra a sessão local mesmo se o servidor estiver fora', async () => {
    const logout = jest.fn().mockRejectedValue(new Error('offline'))
    await render(<AccountPanel logout={logout} />)
    await fireEvent.press(screen.getByRole('button', { name: 'Sair' }))
    await waitFor(() => expect(useAuthStore.getState().status).toBe('signedOut'))
  })

  it('Sair tira o aparelho do push antes de encerrar a sessão', async () => {
    const order: string[] = []
    const forgetPush = jest.fn(async () => {
      order.push(`push:${useAuthStore.getState().status}`)
    })
    await render(<AccountPanel logout={async () => {}} forgetPush={forgetPush} />)
    await fireEvent.press(screen.getByRole('button', { name: 'Sair' }))
    await waitFor(() => expect(useAuthStore.getState().status).toBe('signedOut'))
    expect(order).toEqual(['push:signedIn'])
  })

  it('Sair desconecta a chamada antes de encerrar a sessão', async () => {
    const order: string[] = []
    const leaveCall = jest.fn(async () => {
      order.push(`call:${useAuthStore.getState().status}`)
    })
    await render(<AccountPanel logout={async () => {}} forgetPush={async () => {}} leaveCall={leaveCall} />)
    await fireEvent.press(screen.getByRole('button', { name: 'Sair' }))
    await waitFor(() => expect(useAuthStore.getState().status).toBe('signedOut'))
    expect(order).toEqual(['call:signedIn'])
  })
})
