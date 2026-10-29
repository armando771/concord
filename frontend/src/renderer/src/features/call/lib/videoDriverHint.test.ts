import { afterEach, describe, expect, it, vi } from 'vitest'
import { clearVideoDriverHint, loadVideoDriverHint } from './videoDriverHint'

afterEach(() => {
  vi.unstubAllGlobals()
  clearVideoDriverHint()
})

describe('loadVideoDriverHint', () => {
  it('pergunta ao app uma vez só', async () => {
    const videoHint = vi.fn(async () => 'Instale o nvidia-vaapi-driver para usar a placa de vídeo')
    vi.stubGlobal('window', { api: { screenShare: { videoHint } } })
    expect(await loadVideoDriverHint()).toBe(
      'Instale o nvidia-vaapi-driver para usar a placa de vídeo'
    )
    await loadVideoDriverHint()
    expect(videoHint).toHaveBeenCalledTimes(1)
  })

  it('navegador (sem app), app antigo ou erro: nada', async () => {
    vi.stubGlobal('window', {})
    expect(await loadVideoDriverHint()).toBeNull()
    clearVideoDriverHint()
    vi.stubGlobal('window', { api: { screenShare: {} } })
    expect(await loadVideoDriverHint()).toBeNull()
    clearVideoDriverHint()
    vi.stubGlobal('window', {
      api: { screenShare: { videoHint: async () => Promise.reject(new Error('sem handler')) } }
    })
    expect(await loadVideoDriverHint()).toBeNull()
  })
})
