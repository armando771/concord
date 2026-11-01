import { describe, expect, it } from 'vitest'
import { maskEmail } from './account'

describe('maskEmail', () => {
  it('esconde tudo antes do @', () => {
    expect(maskEmail('mugis@gmail.com')).toBe('*****@gmail.com')
  })

  it('e-mail estranho fica todo escondido', () => {
    expect(maskEmail('semarroba')).toBe('*********')
    expect(maskEmail('')).toBe('*')
  })
})
