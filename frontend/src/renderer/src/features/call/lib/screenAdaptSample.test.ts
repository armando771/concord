import { describe, expect, it } from 'vitest'
import { adaptSample } from './screenAdaptSample'

type Stat = Record<string, unknown> & { id: string; type: string }
const report = (...stats: Stat[]): RTCStatsReport =>
  new Map(stats.map((s) => [s.id, s])) as unknown as RTCStatsReport

const source = (fps: number): Stat => ({
  id: 's1',
  type: 'media-source',
  kind: 'video',
  framesPerSecond: fps
})
const h264: Stat = { id: 'c1', type: 'codec', mimeType: 'video/H264' }
const av1: Stat = { id: 'c2', type: 'codec', mimeType: 'video/AV1' }
const h265: Stat = { id: 'c3', type: 'codec', mimeType: 'video/H265' }
function out(extra: Record<string, unknown>): Stat {
  return {
    id: 'o1',
    type: 'outbound-rtp',
    kind: 'video',
    active: true,
    mediaSourceId: 's1',
    codecId: 'c1',
    bytesSent: 1000,
    framesPerSecond: 60,
    targetBitrate: 7_000_000,
    qualityLimitationReason: 'none',
    ...extra
  }
}
const BUDGET = 7_000_000

describe('adaptSample', () => {
  it('folgado: fps da fonte saindo e banda do preset', () => {
    expect(adaptSample(report(source(60), h264, out({})), BUDGET)).toEqual({
      limited: null,
      softwareCodec: null
    })
  })

  it('o navegador diz que limitou por CPU ou banda', () => {
    expect(
      adaptSample(report(source(60), out({ qualityLimitationReason: 'cpu' })), BUDGET)?.limited
    ).toBe('cpu')
    expect(
      adaptSample(report(source(60), out({ qualityLimitationReason: 'bandwidth' })), BUDGET)
        ?.limited
    ).toBe('bandwidth')
  })

  it('1080p segurando a resolução e soltando quadros (Live A: 5–7 fps): banda se o alvo caiu, senão CPU', () => {
    const lowTarget = out({ framesPerSecond: 6, targetBitrate: 2_000_000 })
    expect(adaptSample(report(source(60), lowTarget), BUDGET)?.limited).toBe('bandwidth')
    const fullTarget = out({ framesPerSecond: 6 })
    expect(adaptSample(report(source(60), fullTarget), BUDGET)?.limited).toBe('cpu')
  })

  it('tela parada manda poucos quadros: não é limitação', () => {
    expect(adaptSample(report(source(3), out({ framesPerSecond: 3 })), BUDGET)?.limited).toBeNull()
  })

  it('banda estimada bem abaixo do preset: banda, mesmo com fps ok', () => {
    expect(
      adaptSample(
        report(source(30), out({ framesPerSecond: 30, targetBitrate: 3_000_000 })),
        BUDGET
      )?.limited
    ).toBe('bandwidth')
  })

  it('envio pausado (ninguém vendo) ou sem envio: sem amostra', () => {
    expect(adaptSample(report(source(60), out({ active: false })), BUDGET)).toBeNull()
    expect(adaptSample(report(), BUDGET)).toBeNull()
  })

  it('AV1 ou H.265 caindo no encoder por software é avisado (qual codec)', () => {
    const soft = out({
      codecId: 'c2',
      encoderImplementation: 'libaom',
      powerEfficientEncoder: false
    })
    expect(adaptSample(report(source(60), av1, soft), BUDGET)?.softwareCodec).toBe('av1')
    const hard = out({
      codecId: 'c2',
      encoderImplementation: 'MediaFoundationVideoEncodeAccelerator',
      powerEfficientEncoder: true
    })
    expect(adaptSample(report(source(60), av1, hard), BUDGET)?.softwareCodec).toBeNull()
    const softHevc = out({ codecId: 'c3', powerEfficientEncoder: false })
    expect(adaptSample(report(source(60), h265, softHevc), BUDGET)?.softwareCodec).toBe('h265')
    const fallback = out({
      codecId: 'c3',
      encoderImplementation: 'SimulcastEncoderAdapter (fallback)'
    })
    expect(adaptSample(report(source(60), h265, fallback), BUDGET)?.softwareCodec).toBe('h265')
  })

  it('H.264 que a placa de vídeo codificaria e caiu no processador é avisado (desliga a camada de 720p automática)', () => {
    const soft = out({ encoderImplementation: 'OpenH264', powerEfficientEncoder: false })
    expect(adaptSample(report(source(60), h264, soft), BUDGET)?.softwareCodec).toBe('h264')
  })

  it('H.264 sem a flag de eficiência não é avisado só pelo nome do encoder', () => {
    const named = out({ encoderImplementation: 'SimulcastEncoderAdapter (fallback)' })
    expect(adaptSample(report(source(60), h264, named), BUDGET)?.softwareCodec).toBeNull()
  })
})
