import { describe, expect, it } from 'vitest'
import { requestScreenQuality, useScreenQualityStore } from './screenQualityStore'

describe('pedido de qualidade', () => {
  it('resolve com a escolha e fecha o modal', async () => {
    const pending = requestScreenQuality()
    useScreenQualityStore.getState().request!.resolve({ resolution: '1080p', frameRate: 60 })
    await expect(pending).resolves.toEqual({ resolution: '1080p', frameRate: 60 })
    expect(useScreenQualityStore.getState().request).toBeNull()
  })

  it('cancela o pedido anterior sem deixar sua limpeza fechar o seguinte', async () => {
    const first = requestScreenQuality()
    const previous = useScreenQualityStore.getState().request!
    const rejected = expect(first).rejects.toMatchObject({ name: 'NotAllowedError' })
    const second = requestScreenQuality()
    previous.resolve(null)
    expect(useScreenQualityStore.getState().request).not.toBeNull()
    useScreenQualityStore.getState().request!.resolve({ resolution: '720p', frameRate: 30 })
    await rejected
    await expect(second).resolves.toEqual({ resolution: '720p', frameRate: 30 })
  })
})
