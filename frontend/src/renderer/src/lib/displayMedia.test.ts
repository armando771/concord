import { describe, expect, it } from 'vitest'
import { displayMediaOptions, retryWithoutAudio } from './displayMedia'

describe('displayMediaOptions', () => {
  it('permite solicitar captura a 60 FPS sem mudar o áudio', () => {
    expect(displayMediaOptions(false, { frameRate: 60 }).video).toEqual({ frameRate: 60 })
  })
  it('desktop: o mesmo pedido de sempre (o picker é o modal do app)', () => {
    expect(displayMediaOptions(false)).toEqual({
      video: { frameRate: 30 },
      audio: {
        restrictOwnAudio: true,
        suppressLocalAudioPlayback: false,
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false
      }
    })
  })

  it('navegador: pede o som do sistema/aba e esconde a própria aba da lista', () => {
    const options = displayMediaOptions(true) as Record<string, unknown>
    expect(options.audio).toEqual(displayMediaOptions(false).audio)
    expect(options.video).toEqual({ frameRate: 30 })
    expect(options).toMatchObject({
      systemAudio: 'include',
      selfBrowserSurface: 'exclude',
      surfaceSwitching: 'include'
    })
  })

  it('sem áudio: mesmo vídeo, audio false', () => {
    expect(displayMediaOptions(true, { audio: false })).toMatchObject({
      video: { frameRate: 30 },
      audio: false
    })
    expect(displayMediaOptions(true, { audio: false })).not.toHaveProperty('systemAudio')
  })
})

describe('retryWithoutAudio', () => {
  const err = (name: string): DOMException => new DOMException('x', name)

  it('navegador que não captura som (TypeError/NotSupportedError): tenta só o vídeo', () => {
    expect(retryWithoutAudio(new TypeError('audio not supported'))).toBe(true)
    expect(retryWithoutAudio(err('NotSupportedError'))).toBe(true)
  })

  it('cancelar ou falhar de outro jeito não repete o pedido', () => {
    expect(retryWithoutAudio(err('NotAllowedError'))).toBe(false)
    expect(retryWithoutAudio(err('AbortError'))).toBe(false)
    expect(retryWithoutAudio(err('NotFoundError'))).toBe(false)
    expect(retryWithoutAudio(undefined)).toBe(false)
  })
})
