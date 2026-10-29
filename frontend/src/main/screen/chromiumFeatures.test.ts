import { describe, expect, it } from 'vitest'
import { chromiumFeatures } from './chromiumFeatures'

describe('chromiumFeatures', () => {
  it('Windows: captura WGC e AV1 por hardware no WebRTC (com o L1T3 que o LiveKit usa na tela)', () => {
    expect(chromiumFeatures('win32')).toEqual({
      enable:
        'AllowWgcWindowCapturer,AllowWgcScreenCapturer,WebRtcAV1HWEncode,D3D12VideoEncodeAcceleratorL1T3',
      disable: 'CalculateNativeWinOcclusion'
    })
  })

  it('Linux: codificação e decodificação por VA-API', () => {
    expect(chromiumFeatures('linux').enable).toBe(
      'AllowWgcWindowCapturer,AllowWgcScreenCapturer,AcceleratedVideoEncoder,AcceleratedVideoDecoder'
    )
  })

  it('macOS: só o que já vinha (VideoToolbox já é o padrão)', () => {
    expect(chromiumFeatures('darwin').enable).toBe('AllowWgcWindowCapturer,AllowWgcScreenCapturer')
  })

  it('sem nome repetido: o Chromium só lê o último --enable-features', () => {
    for (const platform of ['win32', 'linux', 'darwin'] as const) {
      const names = chromiumFeatures(platform).enable.split(',')
      expect(new Set(names).size).toBe(names.length)
    }
  })
})
