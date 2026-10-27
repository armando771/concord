import { describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../../shared/api/client'
import { accountChangeError, submitAccountChange } from './accountChange'

vi.mock('../../../shared/api/client', () => ({
  ApiError: class extends Error {
    constructor(
      public status: number,
      message: string,
      public code?: string
    ) {
      super(message)
    }
  }
}))

describe('accountChangeError', () => {
  it('senha errada, já em uso, reservado e muitas tentativas', () => {
    expect(accountChangeError(new ApiError(403, 'x', 'wrong_password'), 'username')).toBe(
      'Senha incorreta.'
    )
    expect(accountChangeError(new ApiError(409, 'x'), 'username')).toBe(
      'Esse nome de usuário já está em uso.'
    )
    expect(accountChangeError(new ApiError(409, 'x'), 'email')).toBe('Esse e-mail já está em uso.')
    expect(accountChangeError(new ApiError(400, 'esse nome de usuário é reservado'), 'username')).toBe(
      'Esse nome de usuário é reservado.'
    )
    expect(accountChangeError(new ApiError(429, 'x'), 'email')).toMatch(/Muitas tentativas/)
  })
  it('o resto vira a mensagem genérica', () => {
    expect(accountChangeError(new ApiError(500, 'boom'), 'email')).toBe(
      'Não foi possível salvar. Tente de novo.'
    )
    expect(accountChangeError(new Error('rede'), 'email')).toBe(
      'Não foi possível salvar. Tente de novo.'
    )
  })
})

describe('submitAccountChange', () => {
  const ok = vi.fn(async () => {})

  it('valida antes de mandar', async () => {
    const send = vi.fn(async () => {})
    expect(
      await submitAccountChange({ kind: 'username', value: 'a b', password: 'x', current: 'ana', send })
    ).toMatch(/3 a 32/)
    expect(
      await submitAccountChange({ kind: 'email', value: 'nada', password: 'x', current: 'a@x.com', send })
    ).toBe('Informe um e-mail válido.')
    expect(send).not.toHaveBeenCalled()
  })
  it('igual ao atual não manda nada', async () => {
    const send = vi.fn(async () => {})
    expect(
      await submitAccountChange({ kind: 'username', value: ' ana ', password: 'x', current: 'ana', send })
    ).toBe('Esse já é o seu nome de usuário.')
    expect(send).not.toHaveBeenCalled()
  })
  it('pede a senha atual', async () => {
    expect(
      await submitAccountChange({ kind: 'email', value: 'b@x.com', password: '', current: 'a@x.com', send: ok })
    ).toBe('Digite sua senha atual.')
  })
  it('manda o valor sem espaços nas pontas e devolve null', async () => {
    const send = vi.fn(async () => {})
    expect(
      await submitAccountChange({ kind: 'email', value: ' b@x.com ', password: 's', current: 'a@x.com', send })
    ).toBeNull()
    expect(send).toHaveBeenCalledWith('b@x.com', 's')
  })
  it('erro do servidor vira mensagem', async () => {
    const send = vi.fn(async () => {
      throw new ApiError(403, 'x', 'wrong_password')
    })
    expect(
      await submitAccountChange({ kind: 'username', value: 'ana2', password: 's', current: 'ana', send })
    ).toBe('Senha incorreta.')
  })
})
