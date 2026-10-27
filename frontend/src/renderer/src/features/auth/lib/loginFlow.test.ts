import { describe, expect, it, vi } from 'vitest'
import { hasFieldErrors, loginFieldErrors, noticeFromState, runLogin, type LoginDeps } from './loginFlow'
import type { User } from '../store/authStore'

const ME = { id: 'u1', username: 'ana' } as User
const INPUT = { login: 'ana', email: 'ana', password: 'x' }

function deps(over: Partial<LoginDeps> = {}): LoginDeps {
  return {
    login: vi.fn().mockResolvedValue({ access_token: 'a', refresh_token: 'r' }),
    getMe: vi.fn().mockResolvedValue(ME),
    setTokens: vi.fn(),
    setUser: vi.fn(),
    openInvite: vi.fn(),
    ...over
  }
}

const httpError = (status: number): Error & { status: number } =>
  Object.assign(new Error('x'), { status })

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
  it('entra: guarda tokens e usuário e abre o convite pendente', async () => {
    const d = deps()
    expect(await runLogin(d, INPUT, 'K7P2QX9M')).toEqual({ kind: 'ok' })
    expect(d.setTokens).toHaveBeenCalledWith('a', 'r')
    expect(d.setUser).toHaveBeenCalledWith(ME)
    expect(d.openInvite).toHaveBeenCalledWith('K7P2QX9M')
  })

  it('sem convite não abre nada', async () => {
    const d = deps()
    await runLogin(d, INPUT, null)
    expect(d.openInvite).not.toHaveBeenCalled()
  })

  it('401: credenciais inválidas (a tela marca os dois campos)', async () => {
    const d = deps({ login: vi.fn().mockRejectedValue(httpError(401)) })
    expect(await runLogin(d, INPUT, null)).toEqual({ kind: 'invalid' })
  })

  it('sem conexão: mensagem e a marca de "offline" (a tela oferece os detalhes)', async () => {
    const d = deps({ login: vi.fn().mockRejectedValue(new TypeError('Failed to fetch')) })
    expect(await runLogin(d, INPUT, null)).toEqual({
      kind: 'error',
      message: 'Sem conexão com o servidor.',
      offline: true
    })
  })

  it('erro do servidor: mensagem, sem os detalhes de conexão', async () => {
    const d = deps({ getMe: vi.fn().mockRejectedValue(httpError(500)) })
    expect(await runLogin(d, INPUT, null)).toMatchObject({ kind: 'error', offline: false })
  })
})

describe('noticeFromState', () => {
  it('lê o aviso deixado pela tela anterior', () => {
    expect(noticeFromState({ notice: 'Senha alterada.' })).toBe('Senha alterada.')
    expect(noticeFromState(null)).toBeNull()
    expect(noticeFromState({})).toBeNull()
  })
})
