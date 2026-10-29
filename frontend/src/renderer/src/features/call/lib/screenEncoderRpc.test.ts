import { describe, expect, it, vi } from 'vitest'
import { RemoteEncoders, SCREEN_ENCODER_RPC, serveScreenEncoder } from './screenEncoderRpc'
import type { ScreenEncoderInfo } from './screenEncoderInfo'

const info: ScreenEncoderInfo = {
  quality: '1080p 30',
  encoders: [{ codec: 'H265', hardware: true, height: 1080, fps: 30, backup: false }]
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- fixture de teste
function fakeRoom() {
  const handlers = new Map<string, () => Promise<string>>()
  return {
    handlers,
    registerRpcMethod: vi.fn((method: string, handler: () => Promise<string>) => {
      handlers.set(method, handler)
    }),
    unregisterRpcMethod: vi.fn((method: string) => handlers.delete(method)),
    localParticipant: {
      performRpc: vi.fn<
        (params: { destinationIdentity: string; method: string }) => Promise<string>
      >(async () => JSON.stringify(info))
    }
  }
}

const flush = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0))

describe('serveScreenEncoder (quem transmite)', () => {
  it('responde o estado do codificador e para de responder ao sair', async () => {
    const room = fakeRoom()
    const stop = serveScreenEncoder(room, async () => info)
    expect(await room.handlers.get(SCREEN_ENCODER_RPC)?.()).toBe(JSON.stringify(info))
    stop()
    expect(room.unregisterRpcMethod).toHaveBeenCalledWith(SCREEN_ENCODER_RPC)
  })

  it('sem live publicada: responde null', async () => {
    const room = fakeRoom()
    serveScreenEncoder(room, async () => null)
    expect(await room.handlers.get(SCREEN_ENCODER_RPC)?.()).toBe('null')
  })
})

describe('RemoteEncoders (quem assiste)', () => {
  it('a primeira leitura não espera a resposta; a seguinte já tem o codificador', async () => {
    const room = fakeRoom()
    const encoders = new RemoteEncoders(room, () => 0)
    expect(encoders.get('ana')).toBeNull()
    await flush()
    expect(encoders.get('ana')).toEqual(info)
    expect(room.localParticipant.performRpc).toHaveBeenCalledTimes(1)
    expect(room.localParticipant.performRpc).toHaveBeenCalledWith(
      expect.objectContaining({ destinationIdentity: 'ana', method: SCREEN_ENCODER_RPC })
    )
  })

  it('pergunta de novo só depois do intervalo, sem duas perguntas ao mesmo tempo', async () => {
    let now = 0
    const room = fakeRoom()
    const encoders = new RemoteEncoders(room, () => now)
    encoders.get('ana')
    encoders.get('ana')
    await flush()
    expect(room.localParticipant.performRpc).toHaveBeenCalledTimes(1)
    now = 3000
    encoders.get('ana')
    expect(room.localParticipant.performRpc).toHaveBeenCalledTimes(1)
    now = 6000
    expect(encoders.get('ana')).toEqual(info)
    expect(room.localParticipant.performRpc).toHaveBeenCalledTimes(2)
  })

  it('quem transmite tem versão antiga (sem o método) ou não responde: null', async () => {
    const room = fakeRoom()
    room.localParticipant.performRpc.mockRejectedValueOnce(new Error('Method not supported'))
    const encoders = new RemoteEncoders(room, () => 0)
    encoders.get('ana')
    await flush()
    expect(encoders.get('ana')).toBeNull()
  })
})
