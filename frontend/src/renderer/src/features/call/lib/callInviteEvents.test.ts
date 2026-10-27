import { describe, expect, it, vi } from 'vitest'
import { handleCallInviteEvent } from './callInviteEvents'

describe('handleCallInviteEvent', () => {
  it('call:invite_ended invalida os cartões da call', () => {
    const invalid = vi.fn()
    handleCallInviteEvent({ type: 'call:invite_ended', payload: { call_id: 'c1' } }, { invalid })
    expect(invalid).toHaveBeenCalledWith('c1', undefined)
  })

  it('convite usado chega com o papel e só vale para o cartão de quem recebeu', () => {
    const invalid = vi.fn()
    handleCallInviteEvent(
      { type: 'call:invite_ended', payload: { call_id: 'c1', role: 'invitee' } },
      { invalid }
    )
    expect(invalid).toHaveBeenCalledWith('c1', 'invitee')
  })

  it('ignora outros eventos e payload sem call_id', () => {
    const invalid = vi.fn()
    handleCallInviteEvent({ type: 'call:ended', payload: { call_id: 'c1' } }, { invalid })
    handleCallInviteEvent({ type: 'call:invite_ended', payload: null }, { invalid })
    handleCallInviteEvent({ type: 'call:invite_ended', payload: {} }, { invalid })
    expect(invalid).not.toHaveBeenCalled()
  })
})
