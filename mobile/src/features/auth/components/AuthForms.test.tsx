import { fireEvent, render, screen, waitFor } from '@testing-library/react-native'
import type { AuthDeps } from '../lib/authFlow'
import { useAuthStore } from '../store/authStore'
import { ForgotPasswordForm } from './ForgotPasswordForm'
import { LoginForm } from './LoginForm'
import { RegisterForm } from './RegisterForm'

jest.mock('../lib/secureTokens')

const ME = { id: 'u1', username: 'ana', display_name: 'Ana', email: 'a@b.co' }
const httpError = (status: number) => Object.assign(new Error('x'), { status })

function deps(over: Partial<AuthDeps> = {}): AuthDeps {
  return {
    login: jest.fn().mockResolvedValue({ access_token: 'a', refresh_token: 'r' }),
    register: jest.fn().mockResolvedValue({ access_token: 'a', refresh_token: 'r' }),
    forgotPassword: jest.fn().mockResolvedValue(undefined),
    getMe: jest.fn().mockResolvedValue(ME),
    signIn: jest.fn().mockResolvedValue(undefined),
    setUser: jest.fn(),
    ...over
  }
}

const type = (label: string, text: string) => fireEvent.changeText(screen.getByLabelText(label), text)
const press = (name: string) => fireEvent.press(screen.getByRole('button', { name }))

describe('LoginForm', () => {
  beforeEach(() => useAuthStore.setState(useAuthStore.getInitialState(), true))

  it('vazio: mostra o erro sob cada campo e não chama o servidor', async () => {
    const d = deps()
    await render(<LoginForm deps={d} onRegister={() => {}} onForgotPassword={() => {}} />)
    await press('Entrar')
    expect(screen.getByText('Informe seu e-mail ou nome de usuário.')).toBeOnTheScreen()
    expect(screen.getByText('Informe sua senha.')).toBeOnTheScreen()
    expect(d.login).not.toHaveBeenCalled()
  })

  it('preenchido: envia o login e entra', async () => {
    const d = deps()
    await render(<LoginForm deps={d} onRegister={() => {}} onForgotPassword={() => {}} />)
    await type('E-mail ou nome de usuário', ' ana ')
    await type('Senha', 'segredo')
    await press('Entrar')
    await waitFor(() => expect(d.signIn).toHaveBeenCalled())
    expect(d.login).toHaveBeenCalledWith({ login: 'ana', email: 'ana', password: 'segredo' })
  })

  it('401: "Login ou senha inválidos." nos dois campos', async () => {
    const d = deps({ login: jest.fn().mockRejectedValue(httpError(401)) })
    await render(<LoginForm deps={d} onRegister={() => {}} onForgotPassword={() => {}} />)
    await type('E-mail ou nome de usuário', 'ana')
    await type('Senha', 'errada')
    await press('Entrar')
    expect(await screen.findAllByText('Login ou senha inválidos.')).toHaveLength(2)
  })

  it('durante o envio o botão fica desativado', async () => {
    let finish: (v: unknown) => void = () => {}
    const d = deps({ login: jest.fn().mockReturnValue(new Promise((r) => (finish = r))) })
    await render(<LoginForm deps={d} onRegister={() => {}} onForgotPassword={() => {}} />)
    await type('E-mail ou nome de usuário', 'ana')
    await type('Senha', 'x')
    const pressing = press('Entrar') // só termina quando o login responde
    await waitFor(() => expect(screen.getByRole('button', { name: 'Entrar' })).toBeDisabled())
    finish({ access_token: 'a', refresh_token: 'r' })
    await pressing
    await waitFor(() => expect(d.signIn).toHaveBeenCalled())
  })

  it('mostra o aviso "Sua sessão expirou"', async () => {
    useAuthStore.setState({ notice: 'Sua sessão expirou' })
    await render(<LoginForm deps={deps()} onRegister={() => {}} onForgotPassword={() => {}} />)
    expect(screen.getByText('Sua sessão expirou')).toBeOnTheScreen()
  })

  it('links: criar conta e esqueci a senha', async () => {
    const onRegister = jest.fn()
    const onForgotPassword = jest.fn()
    await render(<LoginForm deps={deps()} onRegister={onRegister} onForgotPassword={onForgotPassword} />)
    await fireEvent.press(screen.getByRole('link', { name: 'Registre-se' }))
    await fireEvent.press(screen.getByRole('link', { name: 'Esqueceu a senha?' }))
    expect(onRegister).toHaveBeenCalled()
    expect(onForgotPassword).toHaveBeenCalled()
  })
})

describe('RegisterForm', () => {
  async function fill() {
    await type('E-mail', 'a@b.co')
    await type('Nome de exibição', 'Ana')
    await type('Nome de usuário', 'ana_1')
    await type('Senha', 'senha-forte-123')
    await type('Confirmar senha', 'senha-forte-123')
  }

  it('campos inválidos: erros por campo e nada é enviado', async () => {
    const d = deps()
    await render(<RegisterForm deps={d} onLogin={() => {}} />)
    await press('Continuar')
    expect(screen.getByText('Informe um e-mail válido.')).toBeOnTheScreen()
    expect(screen.getByText('Informe seu nome de exibição.')).toBeOnTheScreen()
    expect(d.register).not.toHaveBeenCalled()
  })

  it('senhas diferentes: "As senhas não conferem."', async () => {
    await render(<RegisterForm deps={deps()} onLogin={() => {}} />)
    await fill()
    await type('Confirmar senha', 'outra-coisa-123')
    await press('Continuar')
    expect(screen.getByText('As senhas não conferem.')).toBeOnTheScreen()
  })

  it('preenchido: cria a conta e entra', async () => {
    const d = deps()
    await render(<RegisterForm deps={d} onLogin={() => {}} />)
    await fill()
    await press('Continuar')
    await waitFor(() => expect(d.signIn).toHaveBeenCalled())
    expect(d.register).toHaveBeenCalledWith({
      username: 'ana_1',
      display_name: 'Ana',
      email: 'a@b.co',
      password: 'senha-forte-123'
    })
  })

  it('409: nome de usuário ou e-mail já em uso', async () => {
    const d = deps({ register: jest.fn().mockRejectedValue(httpError(409)) })
    await render(<RegisterForm deps={d} onLogin={() => {}} />)
    await fill()
    await press('Continuar')
    expect(await screen.findByText('Nome de usuário ou e-mail já em uso.')).toBeOnTheScreen()
  })
})

describe('ForgotPasswordForm', () => {
  it('e-mail inválido: erro no campo', async () => {
    const d = deps()
    await render(<ForgotPasswordForm deps={d} onBack={() => {}} />)
    await type('E-mail', 'nao-e-email')
    await press('Enviar link')
    expect(screen.getByText('Informe um e-mail válido.')).toBeOnTheScreen()
    expect(d.forgotPassword).not.toHaveBeenCalled()
  })

  it('enviado: mostra "Confira seu e-mail"', async () => {
    const d = deps()
    await render(<ForgotPasswordForm deps={d} onBack={() => {}} />)
    await type('E-mail', 'a@b.co')
    await press('Enviar link')
    expect(await screen.findByText('Confira seu e-mail')).toBeOnTheScreen()
    expect(d.forgotPassword).toHaveBeenCalledWith('a@b.co')
  })
})
