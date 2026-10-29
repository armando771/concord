import { ApiError } from '../../../shared/api/client'
import { callErrorMessage } from './callErrors'

describe('callErrorMessage', () => {
  it('sala trancada (423)', () => {
    expect(callErrorMessage(new ApiError(423, 'call is locked'))).toBe('Sala trancada. Peça para alguém abrir.')
  })

  it('sem permissão (403)', () => {
    expect(callErrorMessage(new ApiError(403, 'not allowed'))).toBe('Você não tem permissão para entrar nesse canal de voz.')
  })

  it('ocupado (409)', () => {
    expect(callErrorMessage(new ApiError(409, 'busy'))).toBe('Essa pessoa já está em outra chamada.')
  })

  it('qualquer outro erro vira a mensagem genérica', () => {
    expect(callErrorMessage(new ApiError(500, 'boom'))).toBe('Não foi possível entrar na chamada. Tente de novo.')
    expect(callErrorMessage(new Error('rede'))).toBe('Não foi possível entrar na chamada. Tente de novo.')
  })
})
