import { describe, expect, it, vi } from 'vitest'
import { handlePresenceActivityEvent } from './presenceActivityEvents'

describe('handlePresenceActivityEvent', () => {
  it('guarda o jogo validado de quem mudou', () => {
    const setActivity = vi.fn()
    handlePresenceActivityEvent(
      {
        type: 'presence:activity',
        payload: { user_id: 'u1', activity: { name: 'VALORANT', kind: 'game', started_at: 5 } }
      },
      { setActivity }
    )
    expect(setActivity).toHaveBeenCalledWith('u1', { name: 'VALORANT', kind: 'game', started_at: 5 })
  })

  it('atividade nula ou inválida limpa', () => {
    const setActivity = vi.fn()
    handlePresenceActivityEvent(
      { type: 'presence:activity', payload: { user_id: 'u1', activity: null } },
      { setActivity }
    )
    expect(setActivity).toHaveBeenCalledWith('u1', null)
  })

  it('ignora outros eventos e payload sem usuário', () => {
    const setActivity = vi.fn()
    handlePresenceActivityEvent({ type: 'presence:update', payload: { user_id: 'u1' } }, { setActivity })
    handlePresenceActivityEvent({ type: 'presence:activity', payload: null }, { setActivity })
    handlePresenceActivityEvent({ type: 'presence:activity', payload: { user_id: '' } }, { setActivity })
    expect(setActivity).not.toHaveBeenCalled()
  })
})
