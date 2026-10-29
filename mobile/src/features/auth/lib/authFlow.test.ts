import type { User } from '../store/authStore'
import {
  hasFieldErrors,
  loginFieldErrors,
  runForgotPassword,
  runLogin,
  runRegister,
  type AuthDeps
} from './authFlow'

const ME = { id: 'u1', username: 'ana', display_name: 'Ana', email: 'a@b.co' } as User
const LOGIN = { login: 'ana', email: 'ana', password: 'x' }
const REGISTER = { username: 'ana', display_name: 'Ana', email: 'a@b.co', password: 'senha-forte-123' }

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

const httpError = (status: number): Error & { status: number } => Object.assign(new Error('x'), { status })

describe('loginFieldErrors', () => {
  it('pede usuário e senha', () => {
    const errs = loginFieldErrors('  ', '')
    expect(errs).toEqual({
      identifier: 'Informe seu e-mail ou nome de usuário.',
      password: 'Informe sua senha.'
    })
    expect(hasFieldErrors(errs)).toBe(true)
  })

  it('preenchido: sem erro', () => {
    expect(hasFieldErrors(loginFieldErrors('ana', 'x'))).toBe(false)
    expect(hasFieldErrors({ identifier: null, password: 'x' })).toBe(true)
  })
})

describe('runLogin', () => {
  it('entra: guarda os tokens e depois o usuário', async () => {
    const d = deps()
    expect(await runLogin(d, LOGIN)).toEqual({ kind: 'ok' })
    expect(d.signIn).toHaveBeenCalledWith({ accessToken: 'a', refreshToken: 'r' })
    expect(d.setUser).toHaveBeenCalledWith(ME)
  })

  it('401: credenciais inválidas (a tela marca os dois campos)', async () => {
    const d = deps({ login: jest.fn().mockRejectedValue(httpError(401)) })
    expect(await runLogin(d, LOGIN)).toEqual({ kind: 'invalid' })
    expect(d.signIn).not.toHaveBeenCalled()
  })

  it('sem conexão: mensagem e a marca de "offline"', async () => {
    const d = deps({ login: jest.fn().mockRejectedValue(new TypeError('Network request failed')) })
    expect(await runLogin(d, LOGIN)).toEqual({ kind: 'error', message: 'Sem conexão com o servidor.', offline: true })
  })

  it('erro do servidor: mensagem, sem a marca de offline', async () => {
    const d = deps({ getMe: jest.fn().mockRejectedValue(httpError(500)) })
    expect(await runLogin(d, LOGIN)).toMatchObject({ kind: 'error', offline: false })
  })
})

describe('runRegister', () => {
  it('cria a conta e entra', async () => {
    const d = deps()
    expect(await runRegister(d, REGISTER)).toEqual({ kind: 'ok' })
    expect(d.register).toHaveBeenCalledWith(REGISTER)
    expect(d.signIn).toHaveBeenCalledWith({ accessToken: 'a', refreshToken: 'r' })
    expect(d.setUser).toHaveBeenCalledWith(ME)
  })

  it('409: nome de usuário ou e-mail já em uso', async () => {
    const d = deps({ register: jest.fn().mockRejectedValue(httpError(409)) })
    expect(await runRegister(d, REGISTER)).toEqual({
      kind: 'error',
      message: 'Nome de usuário ou e-mail já em uso.',
      offline: false
    })
  })
})

describe('runForgotPassword', () => {
  it('pede o e-mail de redefinição', async () => {
    const d = deps()
    expect(await runForgotPassword(d, ' a@b.co ')).toEqual({ kind: 'ok' })
    expect(d.forgotPassword).toHaveBeenCalledWith('a@b.co')
  })

  it('429: muitas tentativas', async () => {
    const d = deps({ forgotPassword: jest.fn().mockRejectedValue(httpError(429)) })
    expect(await runForgotPassword(d, 'a@b.co')).toMatchObject({
      kind: 'error',
      message: 'Muitas tentativas. Espere um pouco e tente de novo.'
    })
  })
})
