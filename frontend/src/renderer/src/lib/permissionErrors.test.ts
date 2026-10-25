import { describe, expect, it } from 'vitest'
import { actionErrorMessage } from './permissionErrors'

class CodedError extends Error {
  constructor(
    message: string,
    public code?: string
  ) {
    super(message)
  }
}

describe('actionErrorMessage', () => {
  it('traduz o código do servidor', () => {
    expect(actionErrorMessage(new CodedError('forbidden', 'missing_permission'), 'x')).toBe(
      'Você não tem permissão para isso.'
    )
    expect(actionErrorMessage(new CodedError('x', 'role_hierarchy'), 'x')).toMatch(
      /abaixo do seu cargo/
    )
  })

  it('sem código conhecido usa a mensagem do erro', () => {
    expect(actionErrorMessage(new CodedError('Falha de rede', 'desconhecido'), 'padrão')).toBe(
      'Falha de rede'
    )
    expect(actionErrorMessage(new Error('Falha de rede'), 'padrão')).toBe('Falha de rede')
  })

  it('sem nada, usa o texto padrão', () => {
    expect(actionErrorMessage('estranho', 'padrão')).toBe('padrão')
    expect(actionErrorMessage(null, 'padrão')).toBe('padrão')
    expect(actionErrorMessage(new Error(''), 'padrão')).toBe('padrão')
  })
})
