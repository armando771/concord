import { readFileSync } from 'fs'
import { join } from 'path'
import { describe, expect, it } from 'vitest'
import { encodePowerShell, parseSmtcLine, SMTC_SCRIPT } from './smtcMedia'

// Saída do script do SMTC: uma linha JSON por leitura (com BOM na primeira,
// como o PowerShell às vezes manda), um objeto solto, a lista vazia e um erro.
const [twoSessions, singleObject, empty, error] = readFileSync(
  join(__dirname, 'fixtures', 'smtc-sessions.txt'),
  'utf8'
).split(/\r?\n/)

const NOW = 1761580002000

describe('parseSmtcLine', () => {
  it('lê as sessões e soma à posição o tempo desde a última atualização (tocando)', () => {
    expect(parseSmtcLine(twoSessions, NOW)).toEqual([
      {
        source: 'Spotify.exe',
        title: 'Águas de Março',
        artist: 'Elis Regina',
        album: 'Elis & Tom',
        playing: true,
        positionMs: 85_000,
        durationMs: 225_000
      },
      {
        source: 'Chrome',
        title: 'Vídeo qualquer',
        artist: 'Canal',
        album: '',
        playing: false,
        positionMs: 1000,
        durationMs: 600_000
      }
    ])
  })

  it('aceita um objeto solto no lugar da lista', () => {
    expect(parseSmtcLine(singleObject, NOW)).toEqual([
      expect.objectContaining({ source: 'AIMP.exe', title: 'Rádio', playing: true, durationMs: 0 })
    ])
  })

  it('lista vazia = nada tocando; linha que não é JSON = null', () => {
    expect(parseSmtcLine(empty, NOW)).toEqual([])
    expect(parseSmtcLine(error, NOW)).toBeNull()
    expect(parseSmtcLine('', NOW)).toBeNull()
  })

  it('não passa do fim da faixa nem usa atualização no futuro', () => {
    const line = JSON.stringify({
      app: 'Spotify.exe',
      title: 'x',
      status: 4,
      position: 224_000,
      duration: 225_000,
      updated: NOW - 60_000
    })
    expect(parseSmtcLine(line, NOW)?.[0].positionMs).toBe(225_000)
    const future = JSON.stringify({
      app: 'a',
      title: 'x',
      status: 4,
      position: 5000,
      updated: NOW + 9000
    })
    expect(parseSmtcLine(future, NOW)?.[0].positionMs).toBe(5000)
  })

  it('ignora itens que não são objetos e campos de tipo errado', () => {
    const line = JSON.stringify([1, null, { app: 7, title: 'x', status: '4' }])
    expect(parseSmtcLine(line, NOW)).toEqual([
      {
        source: '',
        title: 'x',
        artist: '',
        album: '',
        playing: false,
        positionMs: 0,
        durationMs: 0
      }
    ])
  })
})

describe('SMTC_SCRIPT', () => {
  it('encerra sozinho quando o app some e escreve em UTF-8', () => {
    const script = SMTC_SCRIPT(4242)
    expect(script).toContain('Get-Process -Id 4242')
    expect(script).toContain('UTF8Encoding')
    expect(script).toContain('GlobalSystemMediaTransportControlsSessionManager')
  })

  it('codifica em UTF-16LE base64 para o -EncodedCommand', () => {
    expect(Buffer.from(encodePowerShell('ok'), 'base64').toString('utf16le')).toBe('ok')
  })
})
