import { describe, expect, it, vi } from 'vitest'
import { acceptInviteAndJoin, type AcceptInviteDeps } from './acceptCallInvite'

const invite = {
  call_id: 'call-1',
  channel_id: 'c1',
  server_id: 's1',
  by: { id: 'ana', username: 'ana', display_name: 'Ana' },
  expires_at: '2026-10-26T12:00:00Z'
}

function deps(over: Partial<AcceptInviteDeps> = {}): AcceptInviteDeps {
  return {
    inDmCall: () => false,
    accept: vi.fn().mockResolvedValue({}),
    resolved: vi.fn(),
    join: vi.fn().mockResolvedValue(undefined),
    navigate: vi.fn(),
    ...over
  }
}

describe('acceptInviteAndJoin', () => {
  it('avisa o servidor, tira o cartão, entra no canal e abre a tela de voz', async () => {
    const d = deps()
    await acceptInviteAndJoin(invite, d)
    expect(d.accept).toHaveBeenCalledWith('call-1')
    expect(d.resolved).toHaveBeenCalledWith('call-1')
    expect(d.join).toHaveBeenCalledWith('c1')
    expect(d.navigate).toHaveBeenCalledWith('/servers/s1/channels/c1')
  })

  it('em chamada de DM não aceita (o convite não é gasto)', async () => {
    const d = deps({ inDmCall: () => true })
    await expect(acceptInviteAndJoin(invite, d)).rejects.toThrow('Você já está em uma chamada.')
    expect(d.accept).not.toHaveBeenCalled()
  })

  it('servidor recusou (expirou): erro sobe e não entra na call', async () => {
    const d = deps({ accept: vi.fn().mockRejectedValue(new Error('404')) })
    await expect(acceptInviteAndJoin(invite, d)).rejects.toThrow('404')
    expect(d.join).not.toHaveBeenCalled()
  })

  it('falha ao entrar: não navega', async () => {
    const d = deps({ join: vi.fn().mockRejectedValue(new Error('sem permissão')) })
    await expect(acceptInviteAndJoin(invite, d)).rejects.toThrow('sem permissão')
    expect(d.navigate).not.toHaveBeenCalled()
  })
})
