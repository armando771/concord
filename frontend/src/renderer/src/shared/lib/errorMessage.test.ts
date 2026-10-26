import { describe, expect, it } from 'vitest'
import { errorMessage } from './errorMessage'

describe('errorMessage', () => {
  it('usa a mensagem do erro', () => {
    expect(errorMessage(new Error('boom'), 'padrão')).toBe('boom')
  })
  it('usa o padrão quando não é um Error', () => {
    expect(errorMessage('x', 'padrão')).toBe('padrão')
    expect(errorMessage(undefined, 'padrão')).toBe('padrão')
  })
})
