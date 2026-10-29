import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  DEFAULT_SCREEN_QUALITY,
  rememberStreamQuality,
  screenEncoding,
  screenMotion,
  screenVideoConstraints,
  streamQuality,
  type ScreenShareQuality
} from './screenShareQuality'

afterEach(() => vi.unstubAllGlobals())

describe('qualidade de tela', () => {
  for (const resolution of ['720p', '1080p', 'source'] as const) {
    for (const frameRate of [30, 60] as const) {
      it(`${resolution}/${frameRate}: captura e envio usam a escolha`, () => {
        const quality = { resolution, frameRate }
        const constraints = screenVideoConstraints(quality, { width: 3840, height: 2160 })
        expect(constraints.frameRate).toEqual({ ideal: frameRate, max: frameRate })
        if (resolution === 'source') {
          expect(constraints).not.toHaveProperty('width')
          expect(constraints).not.toHaveProperty('height')
        } else {
          expect(constraints.width).toEqual({ max: resolution === '720p' ? 1280 : 1920 })
          expect(constraints.height).toEqual({ max: resolution === '720p' ? 720 : 1080 })
        }
        expect(screenEncoding(quality).maxFramerate).toBe(frameRate)
      })
    }
  }

  it('preserva a proporção ultrawide e vertical sem cortar', () => {
    expect(
      screenVideoConstraints(DEFAULT_SCREEN_QUALITY, { width: 3440, height: 1440 })
    ).toMatchObject({ width: { max: 1920 }, height: { max: 803 } })
    expect(
      screenVideoConstraints(DEFAULT_SCREEN_QUALITY, { width: 1080, height: 1920 })
    ).toMatchObject({ width: { max: 607 }, height: { max: 1080 } })
  })

  it('não amplia uma janela pequena', () => {
    expect(
      screenVideoConstraints(DEFAULT_SCREEN_QUALITY, { width: 640, height: 480 })
    ).toMatchObject({ width: { max: 640 }, height: { max: 480 } })
  })

  it('aumenta o orçamento de bitrate conforme resolução e FPS', () => {
    expect(screenEncoding({ resolution: '1080p', frameRate: 60 }).maxBitrate).toBe(8_000_000)
    expect(screenEncoding({ resolution: '720p', frameRate: 30 }).maxBitrate).toBe(2_500_000)
    expect(
      screenEncoding({ resolution: 'source', frameRate: 60 }, { width: 3840, height: 2160 })
        .maxBitrate
    ).toBe(32_000_000)
  })

  it('mantém a qualidade do stream para republicar na reconexão', () => {
    const stream = {} as MediaStream
    const quality: ScreenShareQuality = { resolution: '720p', frameRate: 60 }
    rememberStreamQuality(stream, quality)
    quality.frameRate = 30
    expect(streamQuality(stream)).toEqual({ resolution: '720p', frameRate: 60 })
  })
})

describe('preferências', () => {
  it('usa 1080p/30 para valor inválido e restaura escolhas válidas', async () => {
    vi.resetModules()
    const getItem = vi.fn(() => '{inválido')
    vi.stubGlobal('localStorage', { getItem, setItem: vi.fn() })
    const { loadScreenQuality } = await import('./screenShareQuality')
    expect(loadScreenQuality()).toEqual(DEFAULT_SCREEN_QUALITY)
    getItem.mockReturnValue(JSON.stringify({ resolution: '4k', frameRate: 120 }))
    expect(loadScreenQuality()).toEqual(DEFAULT_SCREEN_QUALITY)
    getItem.mockReturnValue(JSON.stringify({ resolution: 'source', frameRate: 60 }))
    expect(loadScreenQuality()).toEqual({ resolution: 'source', frameRate: 60 })
  })

  it('salva localmente e funciona mesmo se o armazenamento falhar', async () => {
    vi.resetModules()
    const setItem = vi.fn(() => {
      throw new Error('armazenamento bloqueado')
    })
    vi.stubGlobal('localStorage', { getItem: () => null, setItem })
    const { loadScreenQuality, saveScreenQuality } = await import('./screenShareQuality')
    saveScreenQuality({ resolution: '720p', frameRate: 60 })
    expect(setItem).toHaveBeenCalledWith(
      'salinha:screen-share-quality',
      JSON.stringify({ resolution: '720p', frameRate: 60 })
    )
    expect(loadScreenQuality()).toEqual({ resolution: '720p', frameRate: 60 })
  })
})

describe('dica de conteúdo da tela', () => {
  it('60 fps (jogo): movimento, mantendo a fluidez', () => {
    expect(screenMotion(60)).toEqual({
      contentHint: 'motion',
      degradationPreference: 'maintain-framerate'
    })
  })

  it('30 fps (texto, apresentação): detalhe, mantendo a resolução', () => {
    expect(screenMotion(30)).toEqual({
      contentHint: 'detail',
      degradationPreference: 'maintain-resolution'
    })
  })
})
