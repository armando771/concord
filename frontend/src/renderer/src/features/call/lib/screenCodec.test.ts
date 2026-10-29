import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  av1HardwareEncode,
  canEncodeH264,
  markAv1Software,
  loadScreenCodec,
  saveScreenCodec,
  screenCodecOptions,
  SCREEN_CODEC_KEY
} from './screenCodec'

afterEach(() => vi.unstubAllGlobals())

const both = { av1Hardware: true, h264: true }
const h264Only = { av1Hardware: false, h264: true }
const none = { av1Hardware: false, h264: false }

describe('screenCodecOptions', () => {
  it('automático com AV1 na placa de vídeo: AV1, com H.264 de reserva para quem não decodifica', () => {
    expect(screenCodecOptions('auto', both)).toEqual({
      videoCodec: 'av1',
      backupCodec: { codec: 'h264' }
    })
  })

  it('automático sem AV1 por hardware: H.264 com VP8 de reserva', () => {
    expect(screenCodecOptions('auto', h264Only)).toEqual({
      videoCodec: 'h264',
      backupCodec: { codec: 'vp8' }
    })
  })

  it('automático com a camada extra de 720p: H.264 (o AV1 de tela sai numa camada só)', () => {
    expect(screenCodecOptions('auto', both, true).videoCodec).toBe('h264')
  })

  it('H.264 escolhido à mão: H.264 mesmo com AV1 disponível', () => {
    expect(screenCodecOptions('h264', both)).toEqual({
      videoCodec: 'h264',
      backupCodec: { codec: 'vp8' }
    })
  })

  it('sem encoder H.264 no navegador: VP8', () => {
    expect(screenCodecOptions('auto', none)).toEqual({ videoCodec: 'vp8', backupCodec: false })
    expect(screenCodecOptions('h264', none)).toEqual({ videoCodec: 'vp8', backupCodec: false })
  })

  it('VP8 escolhido à mão: VP8 sempre', () => {
    expect(screenCodecOptions('vp8', both)).toEqual({ videoCodec: 'vp8', backupCodec: false })
  })
})

describe('av1HardwareEncode', () => {
  const caps = { codecs: [{ mimeType: 'video/AV1' }, { mimeType: 'video/H264' }] }
  const quality = { width: 1920, height: 1080, bitrate: 7_000_000, framerate: 60 }
  function storage(): Map<string, string> {
    const data = new Map<string, string>()
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => data.get(k) ?? null,
      setItem: (k: string, v: string) => data.set(k, v)
    })
    return data
  }

  it('só com a placa de vídeo (powerEfficient) e no modo de tela do LiveKit (L1T3)', async () => {
    storage()
    const encodingInfo = vi.fn(async () => ({ supported: true, powerEfficient: true, smooth: true }))
    expect(await av1HardwareEncode(quality, { encodingInfo }, caps)).toBe(true)
    expect(encodingInfo).toHaveBeenCalledWith({
      type: 'webrtc',
      video: { contentType: 'video/AV1', scalabilityMode: 'L1T3', ...quality }
    })
  })

  it('AV1 por software (pesado) não serve', async () => {
    storage()
    const encodingInfo = async () => ({ supported: true, powerEfficient: false, smooth: true })
    expect(await av1HardwareEncode(quality, { encodingInfo }, caps)).toBe(false)
  })

  it('sem AV1 no navegador, sem a API ou com erro: não usa', async () => {
    storage()
    const encodingInfo = async () => ({ supported: true, powerEfficient: true, smooth: true })
    expect(await av1HardwareEncode(quality, { encodingInfo }, { codecs: [] })).toBe(false)
    expect(await av1HardwareEncode(quality, undefined, caps)).toBe(false)
    const broken = async () => {
      throw new Error('x')
    }
    expect(await av1HardwareEncode(quality, { encodingInfo: broken }, caps)).toBe(false)
  })

  it('se uma live em AV1 caiu no software, as próximas usam H.264', async () => {
    storage()
    markAv1Software()
    const encodingInfo = async () => ({ supported: true, powerEfficient: true, smooth: true })
    expect(await av1HardwareEncode(quality, { encodingInfo }, caps)).toBe(false)
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
    saveScreenCodec('h264')
    expect(loadScreenCodec()).toBe('h264')
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
