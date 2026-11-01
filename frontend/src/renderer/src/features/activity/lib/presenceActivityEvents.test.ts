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
      { setActivity, setListening: vi.fn() }
    )
    expect(setActivity).toHaveBeenCalledWith('u1', {
      name: 'VALORANT',
      kind: 'game',
      started_at: 5
    })
  })

  it('atividade nula ou inválida limpa', () => {
    const setActivity = vi.fn()
    handlePresenceActivityEvent(
      { type: 'presence:activity', payload: { user_id: 'u1', activity: null } },
      { setActivity, setListening: vi.fn() }
    )
    expect(setActivity).toHaveBeenCalledWith('u1', null)
  })

  it('ignora outros eventos e payload sem usuário', () => {
    const setActivity = vi.fn()
    handlePresenceActivityEvent(
      { type: 'presence:update', payload: { user_id: 'u1' } },
      { setActivity, setListening: vi.fn() }
    )
    handlePresenceActivityEvent(
      { type: 'presence:activity', payload: null },
      { setActivity, setListening: vi.fn() }
    )
    handlePresenceActivityEvent(
      { type: 'presence:activity', payload: { user_id: '' } },
      { setActivity, setListening: vi.fn() }
    )
    expect(setActivity).not.toHaveBeenCalled()
  })

  it('leva a música junto (null = parou); servidor antigo sem o campo não mexe nela', () => {
    const setListening = vi.fn()
    const deps = { setActivity: vi.fn(), setListening }
    const listening = { app: 'Spotify', title: 'Águas de Março', started_at: 5 }
    handlePresenceActivityEvent(
      { type: 'presence:activity', payload: { user_id: 'u1', activity: null, listening } },
      deps
    )
    expect(setListening).toHaveBeenLastCalledWith('u1', listening)
    handlePresenceActivityEvent(
      { type: 'presence:activity', payload: { user_id: 'u1', activity: null, listening: null } },
      deps
    )
    expect(setListening).toHaveBeenLastCalledWith('u1', null)
    setListening.mockClear()
    handlePresenceActivityEvent(
      { type: 'presence:activity', payload: { user_id: 'u1', activity: null } },
      deps
    )
    expect(setListening).not.toHaveBeenCalled()
  })
})
