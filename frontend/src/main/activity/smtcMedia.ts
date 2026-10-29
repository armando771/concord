import type { ChildProcess } from 'child_process'
import type { MediaSession } from './mediaSessions'
import { helperBroken, lineSplitter, nextFailures, restartDelay } from './processLines'

// Windows: as sessões de mídia do sistema (SMTC, a mesma fonte do painel de
// volume do Windows), uma linha JSON por leitura. Quem lê é o helper nativo
// (`concord-audio.exe media-watch`, por eventos); sem ele, um PowerShell que
// fica aberto (smtcPowerShell.ts). Ver docs/adr/0006-musica-em-atividade.md.

/** PlaybackStatus do SMTC: 4 = tocando (5 = pausado, 3 = parado...). */
const SMTC_PLAYING = 4

type Raw = Record<string, unknown>

const text = (value: unknown): string => (typeof value === 'string' ? value : '')
const ms = (value: unknown): number =>
  typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0

/**
 * O SMTC só atualiza a posição de vez em quando (LastUpdatedTime): tocando, a
 * posição de agora é a informada mais o tempo desde então, sem passar do fim.
 */
function positionNow(item: Raw, playing: boolean, now: number): number {
  const updated = ms(item.updated)
  const elapsed = playing && updated > 0 && updated <= now ? now - updated : 0
  const position = ms(item.position) + elapsed
  const duration = ms(item.duration)
  return duration > 0 ? Math.min(position, duration) : position
}

function smtcSession(item: Raw, now: number): MediaSession {
  const playing = item.status === SMTC_PLAYING
  return {
    source: text(item.app),
    title: text(item.title),
    artist: text(item.artist),
    album: text(item.album),
    playing,
    positionMs: positionNow(item, playing, now),
    durationMs: ms(item.duration)
  }
}

const isRecord = (value: unknown): value is Raw => typeof value === 'object' && value !== null

/** Uma linha do script → sessões; null se a linha não é JSON (erro do PowerShell). */
export function parseSmtcLine(line: string, now: number): MediaSession[] | null {
  let raw: unknown
  try {
    raw = JSON.parse(line.replace(/^\uFEFF/, ''))
  } catch {
    return null
  }
  const list = Array.isArray(raw) ? raw : [raw]
  return list.filter(isRecord).map((item) => smtcSession(item, now))
}

/**
 * De onde vêm as linhas: o helper nativo (`concord-audio.exe media-watch`,
 * null = não está no lugar) e o PowerShell de reserva. Mesmo formato nos dois.
 */
export interface SmtcSources {
  helper: (() => ChildProcess) | null
  powershell: () => ChildProcess
  log?: (message: string) => void
}

/**
 * Mantém a fonte aberta e repassa cada leitura: o helper nativo enquanto ele
 * funciona; se ele sair logo sem ler nada (exe antigo, SMTC falhou nele), o
 * PowerShell na hora. Se a fonte cair, abre de novo (e desiste depois de
 * algumas quedas seguidas logo ao abrir: Windows sem SMTC). Devolve o "parar".
 */
export function watchSmtc(
  onSessions: (sessions: MediaSession[]) => void,
  sources: SmtcSources
): () => void {
  let child: ChildProcess | null = null
  let retry: NodeJS.Timeout | null = null
  let failures = 0
  let stopped = false
  let useHelper = sources.helper !== null

  const scheduleRestart = (): void => {
    const delay = restartDelay(failures)
    if (stopped || delay === null) return
    retry = setTimeout(start, delay)
  }

  const onExit = (viaHelper: boolean, livedMs: number, gotLine: boolean): void => {
    if (viaHelper && helperBroken(livedMs, gotLine)) {
      sources.log?.('música: helper nativo não leu o SMTC; usando o PowerShell')
      useHelper = false
      if (!stopped) start()
      return
    }
    failures = nextFailures(failures, livedMs)
    scheduleRestart()
  }

  const start = (): void => {
    const openedAt = Date.now()
    const helper = useHelper ? sources.helper : null
    const viaHelper = helper !== null
    let gotLine = false
    child = helper ? helper() : sources.powershell()
    child.stdout?.setEncoding('utf8')
    child.stdout?.on(
      'data',
      lineSplitter((line) => {
        const sessions = parseSmtcLine(line, Date.now())
        if (!sessions) return
        gotLine = true
        onSessions(sessions)
      })
    )
    child.on('error', () => {})
    child.on('exit', () => onExit(viaHelper, Date.now() - openedAt, gotLine))
  }

  start()
  return () => {
    stopped = true
    if (retry) clearTimeout(retry)
    child?.kill()
  }
}
