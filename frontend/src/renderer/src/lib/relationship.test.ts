import { describe, expect, it } from 'vitest'
import { ApiError } from '../api/client'
import { friendRequestError, relationshipOf } from './relationship'

describe('relationshipOf', () => {
  const lists = {
    friends: [{ id: 'f' }],
    pending: [
      { user_id: 'in', direction: 'incoming' as const },
      { user_id: 'out', direction: 'outgoing' as const }
    ],
    blocked: [{ id: 'x' }]
  }

  it('deriva a relação das listas', () => {
    expect(relationshipOf('f', lists)).toBe('friend')
    expect(relationshipOf('in', lists)).toBe('incoming')
    expect(relationshipOf('out', lists)).toBe('outgoing')
    expect(relationshipOf('x', lists)).toBe('blocked')
    expect(relationshipOf('?', lists)).toBe('none')
  })
})

describe('friendRequestError', () => {
  it('traduz pelo código do servidor', () => {
    expect(friendRequestError(new ApiError(404, 'x', 'user_not_found'))).toMatch(/nome de usuário/)
    expect(friendRequestError(new ApiError(409, 'x', 'already_friends'))).toBe(
      'Vocês já são amigos!'
    )
    expect(friendRequestError(new ApiError(403, 'x', 'not_allowed'))).toMatch(/não está aceitando/)
  })

  it('erro desconhecido tem mensagem genérica', () => {
    expect(friendRequestError(new Error('boom'))).toMatch(/Tente de novo/)
  })
})
