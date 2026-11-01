import { describe, expect, it } from 'vitest'
import {
  encoderInfoFromReport,
  parseEncoderInfo,
  remoteEncoderRows,
  backupRows,
  type ScreenEncoderInfo
} from './screenEncoderInfo'

type Stat = Record<string, unknown> & { id: string; type: string }

function report(...stats: Stat[]): RTCStatsReport {
  return new Map(stats.map((s) => [s.id, s])) as unknown as RTCStatsReport
}

const h265: Stat = { id: 'c1', type: 'codec', mimeType: 'video/H265' }
const h264: Stat = { id: 'c2', type: 'codec', mimeType: 'video/H264' }

const out = (id: string, codecId: string, extra: Record<string, unknown>): Stat => ({
  id,
  type: 'outbound-rtp',
  kind: 'video',
  codecId,
  ...extra
})

describe('encoderInfoFromReport (quem transmite)', () => {
  it('principal H.265 na placa e reserva H.264 no processador, com o degrau saindo', () => {
    const info = encoderInfoFromReport(
      report(
        h265,
        h264,
        out('o1', 'c1', {
          frameHeight: 1080,
          framesPerSecond: 29.6,
          powerEfficientEncoder: true,
          encoderImplementation: 'MediaFoundationVideoEncodeAccelerator'
        }),
        out('o2', 'c2', {
          frameHeight: 720,
          framesPerSecond: 8,
          encoderImplementation: 'OpenH264'
        })
      ),
      '1080p 30',
      'h265'
    )
    expect(info).toEqual({
      quality: '1080p 30',
      encoders: [
        { codec: 'H265', hardware: true, height: 1080, fps: 30, backup: false },
        { codec: 'H264', hardware: false, height: 720, fps: 8, backup: true }
      ]
    })
  })

  it('com a camada extra de 720p: o codec aparece uma vez, pela camada maior', () => {
    const info = encoderInfoFromReport(
      report(
        h265,
        out('o1', 'c1', { frameHeight: 720, framesPerSecond: 30, powerEfficientEncoder: true }),
        out('o2', 'c1', { frameHeight: 1080, framesPerSecond: 30, powerEfficientEncoder: true })
      ),
      '1080p 30',
      'h265'
    )
    expect(info.encoders).toEqual([
      { codec: 'H265', hardware: true, height: 1080, fps: 30, backup: false }
    ])
  })

  it('envio pausado pelo dynacast ou sem codec ainda: não entra', () => {
    const info = encoderInfoFromReport(
      report(h264, out('o1', 'c2', { active: false }), out('o2', 'missing', {})),
      null,
      'h264'
    )
    expect(info).toEqual({ quality: null, encoders: [] })
  })
})

describe('parseEncoderInfo', () => {
  const info: ScreenEncoderInfo = {
    quality: '720p 60',
    encoders: [{ codec: 'H264', hardware: true, height: 720, fps: 60, backup: false }]
  }

  it('lê o que o outro lado mandou', () => {
    expect(parseEncoderInfo(JSON.stringify(info))).toEqual(info)
  })

  it('resposta vazia, quebrada ou de outro formato: null', () => {
    expect(parseEncoderInfo('null')).toBeNull()
    expect(parseEncoderInfo('{')).toBeNull()
    expect(parseEncoderInfo('{"quality":1,"encoders":[]}')).toBeNull()
    expect(parseEncoderInfo('{"quality":null,"encoders":[{"codec":2}]}')).toBeNull()
  })
})

describe('remoteEncoderRows (quem assiste)', () => {
  const info: ScreenEncoderInfo = {
    quality: '1080p 30',
    encoders: [
      { codec: 'H265', hardware: true, height: 1080, fps: 27, backup: false },
      { codec: 'H264', hardware: false, height: 720, fps: 30, backup: true }
    ]
  }

  it('recebendo o principal: onde quem transmite codifica e o degrau saindo', () => {
    expect(remoteEncoderRows(info, 'H265')).toEqual([
      { label: 'Codificado', value: 'Na placa de vídeo' },
      { label: 'Saindo em', value: '1080p 30' }
    ])
  })

  it('recebendo a reserva: a reserva, não o principal', () => {
    expect(remoteEncoderRows(info, 'H264')).toEqual([
      { label: 'Codificado', value: 'No processador' },
      { label: 'Saindo em', value: '720p 30 (reserva)' }
    ])
  })

  it('quem transmite não respondeu (versão antiga) ou não conta: traço', () => {
    expect(remoteEncoderRows(null, 'H264')).toEqual([
      { label: 'Codificado', value: '—' },
      { label: 'Saindo em', value: '—' }
    ])
    const unknown: ScreenEncoderInfo = {
      quality: null,
      encoders: [{ codec: 'VP8', hardware: null, height: null, fps: null, backup: true }]
    }
    expect(remoteEncoderRows(unknown, 'VP8')).toEqual([
      { label: 'Codificado', value: '—' },
      { label: 'Saindo em', value: '—' }
    ])
  })
})

describe('backupRows (Sua transmissão)', () => {
  it('uma linha por reserva saindo; sem reserva, nenhuma', () => {
    const entries = [
      { codec: 'H265', hardware: true, height: 1080, fps: 60, backup: false },
      { codec: 'H264', hardware: true, height: 720, fps: 30, backup: true }
    ]
    expect(backupRows({ quality: null, encoders: entries })).toEqual([
      { label: 'Reserva', value: 'H.264 · placa de vídeo · 720p 30 fps' }
    ])
    expect(
      backupRows({
        quality: null,
        encoders: [{ codec: 'VP8', hardware: null, height: null, fps: null, backup: true }]
      })
    ).toEqual([{ label: 'Reserva', value: 'VP8' }])
    expect(backupRows({ quality: null, encoders: entries.slice(0, 1) })).toEqual([])
  })
})
