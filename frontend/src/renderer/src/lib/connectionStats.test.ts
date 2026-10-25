import { describe, expect, it } from 'vitest'
import { appendPing, averagePing, pingScale, pingSegments, reportLatency } from './connectionStats'

function report(...stats: Array<Record<string, unknown>>): RTCStatsReport {
  return new Map(stats.map((stat, index) => [String(stat.id ?? index), stat])) as RTCStatsReport
}

describe('latência da conexão de voz', () => {
  it('usa o par selecionado pelo transporte e converte segundos em ms', () => {
    expect(
      reportLatency(
        report(
          { type: 'transport', selectedCandidatePairId: 'selected' },
          { id: 'selected', type: 'candidate-pair', currentRoundTripTime: 0.042 },
          {
            type: 'candidate-pair',
            nominated: true,
            state: 'succeeded',
            currentRoundTripTime: 0.9
          },
          { type: 'remote-inbound-rtp', roundTripTime: 0.2 }
        )
      )
    ).toBe(42)
  })

  it('aceita par nomeado e RTCP como alternativas públicas', () => {
    expect(
      reportLatency(
        report({
          type: 'candidate-pair',
          nominated: true,
          state: 'succeeded',
          currentRoundTripTime: 0.025
        })
      )
    ).toBe(25)
    expect(reportLatency(report({ type: 'remote-inbound-rtp', roundTripTime: 0.05 }))).toBe(50)
  })

  it('não inventa zero quando faltam dados ou RTCP ainda não mediu', () => {
    expect(reportLatency(report())).toBeNull()
    for (const roundTripTime of [undefined, NaN, Infinity, -1]) {
      expect(reportLatency(report({ type: 'remote-inbound-rtp', roundTripTime }))).toBeNull()
    }
    expect(
      reportLatency(
        report({ type: 'remote-inbound-rtp', roundTripTime: 0, roundTripTimeMeasurements: 0 })
      )
    ).toBeNull()
    expect(
      reportLatency(
        report({
          type: 'candidate-pair',
          nominated: false,
          state: 'succeeded',
          currentRoundTripTime: 0.2
        })
      )
    ).toBeNull()
  })
})

describe('histórico e gráfico', () => {
  it('mantém no máximo 30 pontos e descarta os que saíram da janela após uma pausa', () => {
    const history = Array.from({ length: 30 }, (_, i) => ({ time: i * 2000, ms: i }))
    expect(appendPing(history, { time: 60000, ms: 30 })).toHaveLength(30)
    expect(appendPing(history, { time: 180000, ms: 42 })).toEqual([{ time: 180000, ms: 42 }])
  })

  it('calcula média só de medições válidas, incluindo zero real', () => {
    expect(averagePing([])).toBeNull()
    expect(averagePing([{ time: 0, ms: null }])).toBeNull()
    expect(
      averagePing([
        { time: 0, ms: 0 },
        { time: 1, ms: null },
        { time: 2, ms: 40 }
      ])
    ).toBe(20)
  })

  it('escala em degraus, sem diminuir entre amostras', () => {
    expect(pingScale([])).toBe(100)
    expect(pingScale([{ time: 0, ms: 142 }])).toBe(150)
    expect(pingScale([{ time: 0, ms: 251 }])).toBe(500)
    expect(pingScale([{ time: 0, ms: 30 }], 500)).toBe(500)
  })

  it('separa lacunas, não preenche histórico e preserva ping zero', () => {
    expect(pingSegments([], 100)).toEqual([])
    expect(pingSegments([{ time: 0, ms: 0 }], 100)).toEqual(['240.0,72.0'])
    const segments = pingSegments(
      [
        { time: 0, ms: 10 },
        { time: 2000, ms: null },
        { time: 4000, ms: 20 },
        { time: 6000, ms: 30 },
        { time: 20000, ms: 40 }
      ],
      100
    )
    expect(segments).toHaveLength(3)
    expect(segments[1].split(' ')).toHaveLength(2)
    expect(segments[2]).toBe('240.0,43.2')
  })
})
