import { describe, expect, it, vi } from 'vitest'
import { handleCallInviteEvent, type CallInviteEventDeps } from './callInviteEvents'

const invite = {
  call_id: 'call-1',
  channel_id: 'c1',
  server_id: 's1',
  by: { id: 'ana', username: 'ana', display_name: 'Ana' },
  expires_at: '2026-10-26T12:00:00Z'
}

function deps(over: Partial<CallInviteEventDeps> = {}): CallInviteEventDeps {
  return {
    meId: () => 'eu',
    received: vi.fn(),
    receivedResolved: vi.fn(),
    sentUpdated: vi.fn(),
    notify: vi.fn(),
    ...over
  }
}

describe('handleCallInviteEvent', () => {
  it('convite recebido: guarda e avisa', () => {
    const d = deps()
    handleCallInviteEvent({ type: 'call:friend_invite', payload: invite }, d)
    expect(d.received).toHaveBeenCalledWith(invite)
    expect(d.notify).toHaveBeenCalledWith(invite)
  })

  it('convite sem quem convidou é ignorado', () => {
    const d = deps()
    handleCallInviteEvent({ type: 'call:friend_invite', payload: { call_id: 'x' } }, d)
    expect(d.received).not.toHaveBeenCalled()
  })

  it('atualização sobre mim: fecha o convite que recebi', () => {
    const d = deps()
    const payload = { call_id: 'call-1', user_id: 'eu', status: 'expired' }
    handleCallInviteEvent({ type: 'call:friend_invite_update', payload }, d)
    expect(d.receivedResolved).toHaveBeenCalledWith('call-1')
    expect(d.sentUpdated).not.toHaveBeenCalled()
  })

  it('atualização sobre outra pessoa: é o convite que eu enviei', () => {
    const d = deps()
    const payload = { call_id: 'call-1', user_id: 'bia', status: 'accepted' }
    handleCallInviteEvent({ type: 'call:friend_invite_update', payload }, d)
    expect(d.sentUpdated).toHaveBeenCalledWith(payload)
    expect(d.receivedResolved).not.toHaveBeenCalled()
  })

  it('outros eventos não fazem nada', () => {
    const d = deps()
    handleCallInviteEvent({ type: 'call:joined', payload: {} }, d)
    expect(d.received).not.toHaveBeenCalled()
    expect(d.sentUpdated).not.toHaveBeenCalled()
  })
})
