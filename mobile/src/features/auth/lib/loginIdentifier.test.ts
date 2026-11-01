import { buildLoginInput, loginIdentifierError } from './loginIdentifier'

describe('loginIdentifierError', () => {
  it('pede o e-mail ou usuário quando vazio', () => {
    expect(loginIdentifierError('')).toBe('Informe seu e-mail ou nome de usuário.')
    expect(loginIdentifierError('   ')).toBe('Informe seu e-mail ou nome de usuário.')
  })

  it('aceita e-mail, usuário e @usuário', () => {
    expect(loginIdentifierError('voce@exemplo.com')).toBeNull()
    expect(loginIdentifierError('nicccls')).toBeNull()
    expect(loginIdentifierError('@SHACO')).toBeNull()
  })
})

describe('buildLoginInput', () => {
  it('manda o valor sem espaços no campo novo e no antigo', () => {
    // "email" continua indo para um backend ainda não atualizado funcionar
    // com e-mail; quem decide se é e-mail ou usuário é o backend.
    expect(buildLoginInput('  @nicccls ', 'senha')).toEqual({
      login: '@nicccls',
      email: '@nicccls',
      password: 'senha'
    })
  })

  it('não mexe na senha', () => {
    expect(buildLoginInput('a@b.com', ' com espaço ').password).toBe(' com espaço ')
  })
})
