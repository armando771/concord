import { describe, expect, it } from 'vitest'
import { ConnectionQuality } from 'livekit-client'
import {
  asCallQuality,
  inboundCounters,
  isPoorQuality,
  lossBetween,
  qualityBars,
  qualityTooltip,
  reportOutboundLoss
} from './connectionQuality'

function report(...stats: Array<Record<string, unknown>>): RTCStatsReport {
  return new Map(stats.map((stat, index) => [String(stat.id ?? index), stat])) as RTCStatsReport
}

describe('qualidade da conexão', () => {
  it('aceita os valores do SDK e cai em "unknown" no resto', () => {
    expect(asCallQuality(ConnectionQuality.Excellent)).toBe('excellent')
    expect(asCallQuality(ConnectionQuality.Good)).toBe('good')
    expect(asCallQuality(ConnectionQuality.Poor)).toBe('poor')
    expect(asCallQuality(ConnectionQuality.Lost)).toBe('lost')
    expect(asCallQuality(ConnectionQuality.Unknown)).toBe('unknown')
    expect(asCallQuality(undefined)).toBe('unknown')
  })

  it('barrinhas: 3 excelente, 2 boa, 1 ruim, 0 caiu/sem medida', () => {
    expect(
      ['excellent', 'good', 'poor', 'lost', 'unknown'].map((q) => qualityBars(asCallQuality(q)))
    ).toEqual([3, 2, 1, 0, 0])
    expect(isPoorQuality('poor')).toBe(true)
    expect(isPoorQuality('lost')).toBe(true)
    expect(isPoorQuality('good')).toBe(false)
  })
})

describe('qualityTooltip', () => {
  it('ruim: explica e mostra perda e latência quando existem', () => {
    expect(qualityTooltip('poor', null, { lossPercent: 8.4, latencyMs: 321.6 })).toBe(
      'Sua conexão está ruim: sua voz pode falhar ou chegar atrasada para os outros. Agora: Perda de pacotes 8% · latência 322 ms.'
    )
    expect(qualityTooltip('poor', 'Ana', { lossPercent: 0.3, latencyMs: null })).toBe(
      'A conexão de Ana está ruim: a voz pode falhar ou chegar atrasada. Agora: Perda de pacotes <1%.'
    )
  })

  it('sem estatística: só a explicação', () => {
    expect(qualityTooltip('poor', 'Ana')).toBe(
      'A conexão de Ana está ruim: a voz pode falhar ou chegar atrasada.'
    )
    expect(qualityTooltip('poor', null, { lossPercent: null, latencyMs: null })).not.toMatch(
      /Agora/
    )
  })

  it('boa/excelente/caiu/medindo', () => {
    expect(qualityTooltip('excellent', null)).toBe('Sua conexão está excelente.')
    expect(qualityTooltip('good', 'Ana')).toBe('Conexão de Ana: boa.')
    expect(qualityTooltip('lost', 'Ana')).toMatch(/Ana perdeu a conexão/)
    expect(qualityTooltip('unknown', null)).toBe('Medindo a conexão…')
  })
})

describe('perda de pacotes (getStats)', () => {
  it('envio: a pior fractionLost do remote-inbound-rtp, em %', () => {
    expect(
      reportOutboundLoss(
        report(
          { type: 'remote-inbound-rtp', fractionLost: 0.02 },
          { type: 'remote-inbound-rtp', fractionLost: 0.1 },
          { type: 'outbound-rtp', packetsSent: 10 }
        )
      )
    ).toBeCloseTo(10)
    expect(reportOutboundLoss(report({ type: 'outbound-rtp' }))).toBeNull()
  })

  it('recebimento: perda entre duas leituras dos contadores', () => {
    const first = inboundCounters(
      report({ type: 'inbound-rtp', packetsReceived: 100, packetsLost: 0 })
    )
    const second = inboundCounters(
      report({ type: 'inbound-rtp', packetsReceived: 190, packetsLost: 10 })
    )!
    expect(lossBetween(first, second)).toBeCloseTo(10)
    expect(lossBetween(null, second)).toBeNull()
  })

  it('contadores que voltam (track nova) ou parados não viram número falso', () => {
    expect(lossBetween({ lost: 5, received: 500 }, { lost: 0, received: 10 })).toBeNull()
    expect(lossBetween({ lost: 5, received: 500 }, { lost: 5, received: 500 })).toBeNull()
    expect(inboundCounters(report({ type: 'outbound-rtp' }))).toBeNull()
  })
})
