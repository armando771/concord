import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  canEncodeH264,
  loadScreenCodec,
  saveScreenCodec,
  screenCodecOptions,
  SCREEN_CODEC_KEY
} from './screenCodec'

afterEach(() => vi.unstubAllGlobals())

describe('screenCodecOptions', () => {
  it('automático: H.264 com VP8 de reserva para quem não decodifica', () => {
    expect(screenCodecOptions('auto', true)).toEqual({
      videoCodec: 'h264',
      backupCodec: { codec: 'vp8' }
    })
  })

  it('automático sem encoder H.264 no navegador: VP8', () => {
    expect(screenCodecOptions('auto', false)).toEqual({ videoCodec: 'vp8', backupCodec: false })
  })

  it('VP8 escolhido à mão: VP8 sempre', () => {
    expect(screenCodecOptions('vp8', true)).toEqual({ videoCodec: 'vp8', backupCodec: false })
  })
})

describe('canEncodeH264', () => {
  it('olha as capacidades de envio do navegador', () => {
    expect(canEncodeH264({ codecs: [{ mimeType: 'video/VP8' }, { mimeType: 'video/H264' }] })).toBe(
      true
    )
    expect(canEncodeH264({ codecs: [{ mimeType: 'video/VP8' }] })).toBe(false)
    expect(canEncodeH264(null)).toBe(false)
  })

  it('sem argumento lê o RTCRtpSender (ausente = sem H.264)', () => {
    vi.stubGlobal('RTCRtpSender', {
      getCapabilities: () => ({ codecs: [{ mimeType: 'video/h264' }] })
    })
    expect(canEncodeH264()).toBe(true)
    vi.stubGlobal('RTCRtpSender', undefined)
    expect(canEncodeH264()).toBe(false)
  })
})

describe('preferência de codec', () => {
  it('padrão automático; salva e lê de volta; valor estranho volta ao automático', () => {
    const data = new Map<string, string>()
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => data.set(k, v)
    })
    expect(loadScreenCodec()).toBe('auto')
    saveScreenCodec('vp8')
    expect(data.get(SCREEN_CODEC_KEY)).toBe('vp8')
    expect(loadScreenCodec()).toBe('vp8')
    data.set(SCREEN_CODEC_KEY, 'av1')
    expect(loadScreenCodec()).toBe('auto')
  })

  it('sem armazenamento local: automático, sem quebrar', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('bloqueado')
      },
      setItem: () => {
        throw new Error('bloqueado')
      }
    })
    expect(loadScreenCodec()).toBe('auto')
    expect(() => saveScreenCodec('vp8')).not.toThrow()
  })
})
