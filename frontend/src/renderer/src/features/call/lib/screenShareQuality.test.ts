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
        // Fonte é limitada a 1440p (como o teto de 1440p dos apps de live).
        const box = { '720p': [1280, 720], '1080p': [1920, 1080], source: [2560, 1440] }[resolution]
        expect(constraints.width).toEqual({ max: box[0] })
        expect(constraints.height).toEqual({ max: box[1] })
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

  it('bitrate de referência por preset (Twitch/YouTube), Fonte com teto de 1440p', () => {
    const bitrate = (quality: ScreenShareQuality, source?: MediaTrackSettings): number =>
      screenEncoding(quality, source).maxBitrate
    expect(bitrate({ resolution: '720p', frameRate: 30 })).toBe(3_000_000)
    expect(bitrate({ resolution: '720p', frameRate: 60 })).toBe(4_500_000)
    expect(bitrate({ resolution: '1080p', frameRate: 30 })).toBe(4_500_000)
    expect(bitrate({ resolution: '1080p', frameRate: 60 })).toBe(7_000_000)
    expect(bitrate({ resolution: 'source', frameRate: 30 }, { width: 3840, height: 2160 })).toBe(
      8_000_000
    )
    expect(bitrate({ resolution: 'source', frameRate: 60 }, { width: 3840, height: 2160 })).toBe(
      10_000_000
    )
    // Fonte numa tela 1080p custa o mesmo que 1080p.
    expect(bitrate({ resolution: 'source', frameRate: 60 }, { width: 1920, height: 1080 })).toBe(
      7_000_000
    )
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
  // A resolução é o piso (nunca abaixo do preset); quem troca de degrau quando
  // falta banda/CPU é o nosso controlador (screenAdaptController).
  it('60 fps (jogo): movimento, mantendo a resolução', () => {
    expect(screenMotion(60)).toEqual({
      contentHint: 'motion',
      degradationPreference: 'maintain-resolution'
    })
  })

  it('30 fps (texto, apresentação): detalhe, mantendo a resolução', () => {
    expect(screenMotion(30)).toEqual({
      contentHint: 'detail',
      degradationPreference: 'maintain-resolution'
    })
  })
})
