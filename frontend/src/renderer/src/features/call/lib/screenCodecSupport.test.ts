import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  clearScreenCodecCache,
  detectScreenCodecs,
  markSoftwareCodec,
  screenCodecSupport
} from './screenCodecSupport'

const video = { width: 1920, height: 1080, bitrate: 7_000_000, framerate: 60 }
const allCaps = {
  codecs: ['video/VP8', 'video/H264', 'video/H265', 'video/AV1'].map((mimeType) => ({ mimeType }))
}

type Info = { supported: boolean; powerEfficient: boolean }
/** encodingInfo que responde por codec (contentType). */
function api(byCodec: Record<string, Info>) {
  return {
    encodingInfo: vi.fn(async (config: { video: { contentType: string } }) => {
      return byCodec[config.video.contentType] ?? { supported: false, powerEfficient: false }
    })
  }
}
const hw = { supported: true, powerEfficient: true }
const sw = { supported: true, powerEfficient: false }

beforeEach(() => {
  const data = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => data.set(k, v)
  })
  clearScreenCodecCache()
})
afterEach(() => vi.unstubAllGlobals())

describe('screenCodecSupport', () => {
  it('pergunta cada codec no tamanho da live; AV1 no modo de tela do LiveKit (L1T3)', async () => {
    const encoding = api({ 'video/AV1': hw, 'video/H265': hw, 'video/H264': hw })
    expect(await screenCodecSupport(video, encoding, allCaps)).toEqual({
      av1: 'hardware',
      h265: 'hardware',
      h264: 'hardware',
      vp8: 'software'
    })
    expect(encoding.encodingInfo).toHaveBeenCalledWith({
      type: 'webrtc',
      video: { contentType: 'video/AV1', scalabilityMode: 'L1T3', ...video }
    })
    expect(encoding.encodingInfo).toHaveBeenCalledWith({
      type: 'webrtc',
      video: { contentType: 'video/H265', ...video }
    })
  })

  it('powerEfficient falso = processador; não suportado = não codifica', async () => {
    const encoding = api({ 'video/AV1': sw, 'video/H264': sw })
    expect(await screenCodecSupport(video, encoding, allCaps)).toEqual({
      av1: 'software',
      h265: null,
      h264: 'software',
      vp8: 'software'
    })
  })

  it('codec fora das capacidades de envio do navegador não codifica (nem pergunta)', async () => {
    const encoding = api({ 'video/AV1': hw, 'video/H265': hw, 'video/H264': hw })
    const caps = { codecs: [{ mimeType: 'video/vp8' }, { mimeType: 'video/h264' }] }
    const support = await screenCodecSupport(video, encoding, caps)
    expect(support).toMatchObject({ av1: null, h265: null, h264: 'hardware' })
    expect(encoding.encodingInfo).toHaveBeenCalledTimes(1)
  })

  it('sem a API ou com erro: o navegador codifica, mas não dá para saber se é na placa', async () => {
    expect(await screenCodecSupport(video, undefined, allCaps)).toMatchObject({
      av1: 'software',
      h265: 'software',
      h264: 'software'
    })
    const broken = {
      encodingInfo: async () => {
        throw new Error('x')
      }
    }
    expect(await screenCodecSupport(video, broken, allCaps)).toMatchObject({ h265: 'software' })
  })

  it('codec que já caiu no processador numa live conta como processador', async () => {
    markSoftwareCodec('h265')
    const encoding = api({ 'video/AV1': hw, 'video/H265': hw, 'video/H264': hw })
    expect(await screenCodecSupport(video, encoding, allCaps)).toMatchObject({
      av1: 'hardware',
      h265: 'software'
    })
  })
})

describe('detectScreenCodecs', () => {
  it('guarda a resposta na sessão por tamanho; marcar um codec refaz a detecção', async () => {
    const encoding = api({ 'video/AV1': hw, 'video/H265': hw, 'video/H264': hw })
    vi.stubGlobal('navigator', { mediaCapabilities: encoding })
    vi.stubGlobal('RTCRtpSender', { getCapabilities: () => allCaps })
    await detectScreenCodecs(video)
    await detectScreenCodecs(video)
    expect(encoding.encodingInfo).toHaveBeenCalledTimes(3)
    await detectScreenCodecs({ ...video, framerate: 30 })
    expect(encoding.encodingInfo).toHaveBeenCalledTimes(6)
    markSoftwareCodec('av1')
    expect((await detectScreenCodecs(video)).av1).toBe('software')
  })

  it('sem RTCRtpSender: só VP8', async () => {
    vi.stubGlobal('RTCRtpSender', undefined)
    vi.stubGlobal('navigator', {})
    expect(await detectScreenCodecs(video)).toEqual({
      av1: null,
      h265: null,
      h264: null,
      vp8: 'software'
    })
  })
})
