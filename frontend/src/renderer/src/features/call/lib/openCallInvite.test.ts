import { describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../../shared/api/client'
import { openInviteAndJoin, type OpenInviteDeps } from './openCallInvite'

const invite = { call_id: 'call-1', channel_id: 'c1', server_id: 's1' }

function deps(over: Partial<OpenInviteDeps> = {}): OpenInviteDeps {
  return {
    inDmCall: () => false,
    open: vi.fn().mockResolvedValue({ admitted: true }),
    invalid: vi.fn(),
    join: vi.fn().mockResolvedValue(undefined),
    navigate: vi.fn(),
    ...over
  }
}

describe('openInviteAndJoin', () => {
  it('pede o passe, entra no canal e abre a tela de voz', async () => {
    const d = deps()
    await openInviteAndJoin(invite, d)
    expect(d.open).toHaveBeenCalledWith('call-1')
    expect(d.join).toHaveBeenCalledWith('c1')
    expect(d.navigate).toHaveBeenCalledWith('/servers/s1/channels/c1')
    expect(d.invalid).not.toHaveBeenCalled()
  })

  it('em chamada de DM não abre', async () => {
    const d = deps({ inDmCall: () => true })
    await expect(openInviteAndJoin(invite, d)).rejects.toThrow('Você já está em uma chamada.')
    expect(d.open).not.toHaveBeenCalled()
  })

  it('call acabou (404): invalida o cartão e não entra', async () => {
    const d = deps({ open: vi.fn().mockRejectedValue(new ApiError(404, 'not found')) })
    await openInviteAndJoin(invite, d)
    expect(d.invalid).toHaveBeenCalledWith('call-1')
    expect(d.join).not.toHaveBeenCalled()
    expect(d.navigate).not.toHaveBeenCalled()
  })

  it('outro erro do servidor sobe e não invalida', async () => {
    const d = deps({ open: vi.fn().mockRejectedValue(new ApiError(500, 'boom')) })
    await expect(openInviteAndJoin(invite, d)).rejects.toThrow('boom')
    expect(d.invalid).not.toHaveBeenCalled()
  })

  it('falha ao entrar (sem permissão): não navega', async () => {
    const d = deps({ join: vi.fn().mockRejectedValue(new Error('sem permissão')) })
    await expect(openInviteAndJoin(invite, d)).rejects.toThrow('sem permissão')
    expect(d.navigate).not.toHaveBeenCalled()
  })
})
