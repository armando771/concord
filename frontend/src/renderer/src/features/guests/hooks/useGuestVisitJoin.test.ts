import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../../../shared/api/client'

const { api, call, toast } = vi.hoisted(() => ({
  api: { joinWithAccount: vi.fn() },
  call: { joinVoiceChannel: vi.fn() },
  toast: { error: vi.fn() }
}))
vi.mock('../api/guestInvites', () => api)
vi.mock('../../call/store/callStore', () => ({ useCallStore: { getState: () => call } }))
vi.mock('../../../shared/store/toastStore', () => ({ showToast: toast }))

import { enterVisitCall, joinVisit } from './useGuestVisitJoin'
import { useGuestVisitsStore } from '../store/guestVisitsStore'

const pass = {
  server_id: 's',
  server_name: 'BH RX',
  channel_id: 'c',
  channel_name: 'Sala',
  expires_at: '2099-01-01T00:00:00Z',
  can_speak: true,
  can_stream: false
}

describe('entrar como visitante com a conta', () => {
  beforeEach(() => {
    useGuestVisitsStore.getState().reset()
    call.joinVoiceChannel.mockReset().mockResolvedValue(undefined)
    toast.error.mockReset()
  })

  it('vira uma visita no trilho, entra na call e abre a tela dela', async () => {
    api.joinWithAccount.mockResolvedValue({ pass })
    await expect(joinVisit('tok')).resolves.toBe('/visitas/s')
    expect(useGuestVisitsStore.getState().visits).toEqual([pass])
    expect(call.joinVoiceChannel).toHaveBeenCalledWith('c')
  })

  it('já é membro: vai direto para o canal no servidor', async () => {
    api.joinWithAccount.mockRejectedValue(
      new ApiError(409, 'x', 'already_member', { server_id: 's', channel_id: 'c' })
    )
    await expect(joinVisit('tok')).resolves.toBe('/servers/s/channels/c')
    expect(useGuestVisitsStore.getState().visits).toEqual([])
    expect(call.joinVoiceChannel).not.toHaveBeenCalled()
  })

  it('link que não abre vira a mensagem do erro', async () => {
    api.joinWithAccount.mockRejectedValue(new ApiError(403, 'x', 'access_ended'))
    await expect(joinVisit('tok')).rejects.toThrow('Seu acesso de visitante foi encerrado.')
  })

  it('a call que não abre vira aviso', async () => {
    call.joinVoiceChannel.mockRejectedValue(new Error('Você já está em uma chamada.'))
    await enterVisitCall('c')
    expect(toast.error).toHaveBeenCalledWith('Você já está em uma chamada.')
    call.joinVoiceChannel.mockRejectedValue('?')
    await enterVisitCall('c')
    expect(toast.error).toHaveBeenLastCalledWith('Não foi possível entrar na call.')
  })
})
