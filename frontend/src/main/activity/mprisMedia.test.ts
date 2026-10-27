import { readFileSync } from 'fs'
import { join } from 'path'
import { describe, expect, it } from 'vitest'
import { parseBusNames, parseIdentity, parsePlayer, readMprisSessions } from './mprisMedia'

// Saídas reais do `busctl --user --json=short` (player MPRIS de teste nesta máquina).
const fixture = (name: string): string => readFileSync(join(__dirname, 'fixtures', name), 'utf8')
const LIST = fixture('mpris-listnames.json')
const SPOTIFY = fixture('mpris-spotify-getall.json')
const FIREFOX = fixture('mpris-firefox-paused-getall.json')
const IDENTITY = fixture('mpris-identity.json')

describe('parseBusNames', () => {
  it('só os players MPRIS, sem o próprio app (chromium.instance<pid>)', () => {
    expect(parseBusNames(LIST, 4242)).toEqual([
      'org.mpris.MediaPlayer2.spotify',
      'org.mpris.MediaPlayer2.firefox.instance_1_37'
    ])
  })

  it('saída inválida = nenhum player', () => {
    expect(parseBusNames('', 1)).toEqual([])
    expect(parseBusNames('{"type":"as","data":"x"}', 1)).toEqual([])
  })
})

describe('parsePlayer', () => {
  it('lê título, artistas, álbum, duração e posição (microssegundos → ms)', () => {
    expect(parsePlayer(SPOTIFY)).toEqual({
      title: 'Águas de Março',
      artist: 'Elis Regina, Tom Jobim',
      album: 'Elis & Tom',
      playing: true,
      positionMs: 83_893,
      durationMs: 225_000
    })
  })

  it('pausado, sem posição e com o endereço da página', () => {
    expect(parsePlayer(FIREFOX)).toEqual({
      title: 'Garota de Ipanema',
      artist: 'Astrud Gilberto',
      album: '',
      url: 'https://music.youtube.com/watch?v=abc',
      playing: false,
      positionMs: 0,
      durationMs: 323_000
    })
  })

  it('saída inválida = null', () => {
    expect(parsePlayer('erro')).toBeNull()
    expect(parsePlayer('{"type":"a{sv}","data":[]}')).toBeNull()
  })
})

describe('parseIdentity', () => {
  it('lê o nome do player', () => {
    expect(parseIdentity(IDENTITY)).toBe('Spotify')
    expect(parseIdentity('nada')).toBe('')
  })
})

describe('readMprisSessions', () => {
  it('consulta cada player e guarda o Identity em cache', async () => {
    const calls: string[] = []
    const run = async (args: string[]): Promise<string | null> => {
      calls.push(args.join(' '))
      if (args[0] === 'call' && args[1] === 'org.freedesktop.DBus') return LIST
      if (args[0] === 'get-property') return args[1].endsWith('spotify') ? IDENTITY : null
      return args[1].endsWith('spotify') ? SPOTIFY : FIREFOX
    }
    const identities = new Map<string, string>()
    const sessions = await readMprisSessions(run, 4242, identities)
    expect(sessions.map((s) => s.source)).toEqual(['spotify Spotify', 'firefox.instance_1_37'])
    expect(sessions[1].url).toBe('https://music.youtube.com/watch?v=abc')

    calls.length = 0
    await readMprisSessions(run, 4242, identities)
    expect(calls.filter((c) => c.startsWith('get-property'))).toEqual([])
  })

  it('busctl ausente ou falhando = nenhuma sessão', async () => {
    expect(await readMprisSessions(async () => null, 1)).toEqual([])
  })
})
