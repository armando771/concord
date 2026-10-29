import { passwordStrength, validateRegister, validateReset, type RegisterValues } from './authForms'

const valid: RegisterValues = {
  username: 'hugo_1',
  displayName: 'Hugo',
  email: 'hugo@exemplo.com',
  password: 'senha-forte-123',
  confirm: 'senha-forte-123'
}

describe('validateRegister', () => {
  it('não acusa nada em dados válidos', () => {
    expect(validateRegister(valid)).toEqual({})
  })

  it('devolve um erro por campo, todos de uma vez', () => {
    const errors = validateRegister({
      ...valid,
      username: 'a@b',
      displayName: '  ',
      email: 'admin',
      password: 'curta',
      confirm: 'outra'
    })
    expect(Object.keys(errors).sort()).toEqual(
      ['confirm', 'displayName', 'email', 'password', 'username'].sort()
    )
  })

  it('nome de exibição sem invisíveis, controle ou bidi (emoji com ZWJ vale)', () => {
    for (const bad of ['\u{200b}', 'Hu\u{0}go', 'Hu\u{202e}go', '\u{3164}', 'Hu\ngo']) {
      expect(validateRegister({ ...valid, displayName: bad }).displayName).toBe('O nome de exibição não pode ter caracteres invisíveis ou de controle.')
    }
    expect(validateRegister({ ...valid, displayName: '👨\u{200d}👩\u{200d}👧' })).toEqual({})
  })

  it('senha acima de 72 bytes é recusada', () => {
    const long = 'é'.repeat(37)
    expect(validateRegister({ ...valid, password: long, confirm: long }).password).toMatch(/72/)
  })

  it('confirmação diferente marca só a confirmação', () => {
    const errors = validateRegister({ ...valid, confirm: 'diferente-123' })
    expect(Object.keys(errors)).toEqual(['confirm'])
  })
})

describe('validateReset', () => {
  it('exige senha válida e confirmação igual', () => {
    expect(validateReset('senha-forte-123', 'senha-forte-123')).toEqual({})
    expect(validateReset('curta', 'curta').password).toBeDefined()
    expect(validateReset('senha-forte-123', 'x').confirm).toBeDefined()
  })
})

describe('passwordStrength', () => {
  it('vai de vazia a forte', () => {
    expect(passwordStrength('')).toBe(0)
    expect(passwordStrength('abc')).toBe(1)
    expect(passwordStrength('Senha-Forte-123!')).toBe(4)
  })
})
