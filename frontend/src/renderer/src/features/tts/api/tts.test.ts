import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../../../shared/api/client', async (importOriginal) => {
  const real = await importOriginal<typeof import('../../../shared/api/client')>()
  return { ...real, request: vi.fn() }
})

import { ApiError, request } from '../../../shared/api/client'
import { sendChannelMessage, sendConversationMessage } from '../../chat/api/messages'

const mocked = vi.mocked(request)

describe('envio do /tts', () => {
  beforeEach(() => {
    mocked.mockReset()
    mocked.mockResolvedValue({ id: 'm1' })
  })

  it('canal: "/tts texto" vai para a rota TTS só com o texto', async () => {
    await sendChannelMessage('c1', '/tts  bom dia ')
    expect(mocked).toHaveBeenCalledWith('/channels/c1/tts', {
      method: 'POST',
      body: JSON.stringify({ content: 'bom dia' })
    })
  })

  it('DM: pela rota da conversa', async () => {
    await sendConversationMessage('d1', '/tts oi')
    expect(mocked.mock.calls[0][0]).toBe('/conversations/d1/tts')
  })

  it('mensagem comum e /tts com anexo seguem pela rota normal', async () => {
    await sendChannelMessage('c1', 'oi /tts')
    await sendChannelMessage('c1', '/tts oi', ['a1'])
    expect(mocked.mock.calls.map((c) => c[0])).toEqual([
      '/channels/c1/messages',
      '/channels/c1/messages'
    ])
  })

  it('recusa do /tts vira aviso em português (o código continua)', async () => {
    mocked.mockRejectedValue(new ApiError(429, 'tts cooldown', 'tts_cooldown', { retry_after: 4 }))
    const err = await sendChannelMessage('c1', '/tts oi').catch((e: ApiError) => e)
    expect(err).toBeInstanceOf(ApiError)
    expect((err as ApiError).message).toBe('Espere 4 s para mandar outra mensagem TTS.')
    expect((err as ApiError).status).toBe(429)
  })

  it('outros erros passam como vieram', async () => {
    const original = new ApiError(403, 'missing permission', 'missing_permission', {})
    mocked.mockRejectedValue(original)
    await expect(sendChannelMessage('c1', '/tts oi')).rejects.toBe(original)
  })
})
