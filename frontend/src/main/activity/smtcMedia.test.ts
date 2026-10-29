import { readFileSync } from 'fs'
import { join } from 'path'
import type { ChildProcess } from 'child_process'
import { EventEmitter } from 'events'
import { PassThrough } from 'stream'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { parseSmtcLine, watchSmtc, type SmtcSources } from './smtcMedia'

// Saída do script do SMTC: uma linha JSON por leitura (com BOM na primeira,
// como o PowerShell às vezes manda), um objeto solto, a lista vazia e um erro.
const [twoSessions, singleObject, empty, error] = readFileSync(
  join(__dirname, 'fixtures', 'smtc-sessions.txt'),
  'utf8'
).split(/\r?\n/)

// Saída real do `concord-audio.exe media-watch` (mesmo formato, a sessão atual primeiro).
const [helperLine] = readFileSync(join(__dirname, 'fixtures', 'smtc-helper.txt'), 'utf8').split(
  /\r?\n/
)

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

describe('parseSmtcLine com a saída do helper nativo', () => {
  it('lê as sessões do helper como as do PowerShell', () => {
    expect(parseSmtcLine(helperLine, NOW)).toEqual([
      {
        source: 'Spotify.exe',
        title: 'Águas de Março',
        artist: 'Elis Regina',
        album: 'Elis & Tom',
        playing: true,
        positionMs: 85_000,
        durationMs: 225_000
      },
      expect.objectContaining({ source: 'Chrome', playing: false, positionMs: 1000 })
    ])
  })
})

/** Processo falso: o teste escreve no stdout e manda sair. */
interface FakeChild {
  child: ChildProcess
  write: (text: string) => void
  exit: () => void
  killed: () => boolean
}

function fakeChild(): FakeChild {
  const emitter = new EventEmitter()
  const stdout = new PassThrough()
  let killed = false
  const exit = (): void => {
    emitter.emit('exit', null)
  }
  const kill = (): boolean => {
    killed = true
    exit()
    return true
  }
  const child = Object.assign(emitter, { stdout, kill }) as unknown as ChildProcess
  return { child, write: (text) => stdout.write(text), exit, killed: () => killed }
}

/** Fontes falsas que guardam cada processo aberto. */
function fakeSources(withHelper: boolean): {
  sources: SmtcSources
  helpers: FakeChild[]
  shells: FakeChild[]
} {
  const helpers: FakeChild[] = []
  const shells: FakeChild[] = []
  const open = (list: FakeChild[]) => (): ChildProcess => {
    const fake = fakeChild()
    list.push(fake)
    return fake.child
  }
  const sources = { helper: withHelper ? open(helpers) : null, powershell: open(shells) }
  return { sources, helpers, shells }
}

/** Deixa o PassThrough entregar o que foi escrito. */
const flush = (): Promise<void> => new Promise((resolve) => setImmediate(resolve))

describe('watchSmtc', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'Date'] })
    vi.setSystemTime(NOW)
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('usa o helper nativo quando ele existe', async () => {
    const { sources, helpers, shells } = fakeSources(true)
    const seen: string[][] = []
    watchSmtc((sessions) => seen.push(sessions.map((s) => s.source)), sources)
    helpers[0].write(`${helperLine}\n`)
    await flush()
    expect(shells).toHaveLength(0)
    expect(seen).toEqual([['Spotify.exe', 'Chrome']])
  })

  it('sem helper, vai de PowerShell', () => {
    const { sources, shells } = fakeSources(false)
    watchSmtc(() => {}, sources)
    expect(shells).toHaveLength(1)
  })

  it('helper que sai logo sem ler nada (antigo ou SMTC falhou nele) dá lugar ao PowerShell na hora', () => {
    const { sources, helpers, shells } = fakeSources(true)
    watchSmtc(() => {}, sources)
    vi.advanceTimersByTime(500)
    helpers[0].exit()
    expect(shells).toHaveLength(1)
    // Daí em diante, só PowerShell.
    shells[0].exit()
    vi.advanceTimersByTime(60_000)
    expect(helpers).toHaveLength(1)
    expect(shells).toHaveLength(2)
  })

  it('helper que funcionou e caiu abre de novo depois de um tempo, sem trocar de fonte', async () => {
    const { sources, helpers, shells } = fakeSources(true)
    watchSmtc(() => {}, sources)
    helpers[0].write(`${helperLine}\n`)
    await flush()
    helpers[0].exit()
    expect(helpers).toHaveLength(1)
    vi.advanceTimersByTime(30_000)
    expect(helpers).toHaveLength(2)
    expect(shells).toHaveLength(0)
  })

  it('parar mata o processo e não abre outro', () => {
    const { sources, helpers, shells } = fakeSources(true)
    const stop = watchSmtc(() => {}, sources)
    stop()
    expect(helpers[0].killed()).toBe(true)
    vi.advanceTimersByTime(120_000)
    expect(helpers).toHaveLength(1)
    expect(shells).toHaveLength(0)
  })
})
