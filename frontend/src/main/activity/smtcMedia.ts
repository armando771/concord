import type { ChildProcess } from 'child_process'
import type { MediaSession } from './mediaSessions'
import { lineSplitter, nextFailures, restartDelay } from './processLines'
import { spawnSmtcPowerShell } from './smtcPowerShell'

// Windows: as sessões de mídia do sistema (SMTC, a mesma fonte do painel de
// volume do Windows) lidas por um PowerShell que fica aberto e escreve uma
// linha JSON a cada 2 s. Sem dependência nova: o WinRT vem do próprio Windows
// (docs/adr/0006-musica-em-atividade.md).

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
    raw = JSON.parse(line.replace(/^﻿/, ''))
  } catch {
    return null
  }
  const list = Array.isArray(raw) ? raw : [raw]
  return list.filter(isRecord).map((item) => smtcSession(item, now))
}

/**
 * Mantém o PowerShell aberto e repassa cada leitura. Se ele cair, abre de novo
 * (e desiste depois de algumas quedas seguidas logo ao abrir: Windows sem SMTC).
 * Devolve o "parar".
 */
export function watchSmtc(onSessions: (sessions: MediaSession[]) => void): () => void {
  let child: ChildProcess | null = null
  let retry: NodeJS.Timeout | null = null
  let failures = 0
  let stopped = false

  const onLine = (line: string): void => {
    const sessions = parseSmtcLine(line, Date.now())
    if (sessions) onSessions(sessions)
  }

  const scheduleRestart = (): void => {
    const delay = restartDelay(failures)
    if (stopped || delay === null) return
    retry = setTimeout(start, delay)
  }

  const start = (): void => {
    const openedAt = Date.now()
    child = spawnSmtcPowerShell()
    child.stdout?.setEncoding('utf8')
    child.stdout?.on('data', lineSplitter(onLine))
    child.on('error', () => {})
    child.on('exit', () => {
      failures = nextFailures(failures, Date.now() - openedAt)
      scheduleRestart()
    })
  }

  start()
  return () => {
    stopped = true
    if (retry) clearTimeout(retry)
    child?.kill()
  }
}
