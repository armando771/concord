import type { ProcessMetric } from 'electron'
import type {
  PerfContext,
  PerfEvent,
  PerfReport,
  SampleLine,
  WindowState
} from '../../shared/perfLog'
import { ProcessBreakdown } from './processBreakdown'
import { StartupMarks, type StartupMark } from './startupMarks'

type Reading = Pick<ProcessMetric, 'pid' | 'creationTime' | 'memory' | 'cpu' | 'type'>

/** FPS e LoAF de um relatório mais velho que isso não valem para a amostra. */
const STALE_MS = 2000
// Fora de "visible" o Chromium limita o rAF a 1 Hz e cada segundo vira um "quadro longo"
// de ~1000 ms: FPS e LoAF só são medidos com a janela visível.
const NO_CONTEXT: PerfContext = { route: '', inCall: false, sharing: false, watching: false }

/** Junta o que o renderer informa com o que o main mede e escreve as linhas do log. */
export class PerfSession {
  private readonly breakdown = new ProcessBreakdown()
  private readonly startup = new StartupMarks()
  private latest: { report: PerfReport; atMs: number } | null = null

  constructor(
    private readonly write: (line: object) => void,
    private readonly cores: number
  ) {}

  mark(name: StartupMark, nowMs: number): void {
    this.startup.mark(name, nowMs)
    this.flushStartup(nowMs)
  }

  receive(event: PerfEvent, nowMs: number): void {
    if (event.kind === 'mark') this.mark(event.name, nowMs)
    else this.latest = { report: event, atMs: nowMs }
  }

  sample(readings: Reading[], window: WindowState, nowMs: number): void {
    const last = this.latest
    const valid = last !== null && window === 'visible' && nowMs - last.atMs <= STALE_MS
    const fresh = valid ? last.report : null
    const line: SampleLine = {
      t: Math.round(nowMs / 100) / 10,
      kind: 'sample',
      ctx: { window, ...(last?.report.ctx ?? NO_CONTEXT) },
      procs: this.breakdown.sample(readings, nowMs, this.cores),
      fps: fresh?.fps ?? null,
      loaf: fresh?.loaf ?? null
    }
    this.write(line)
    this.flushStartup(nowMs)
  }

  private flushStartup(nowMs: number): void {
    const line = this.startup.take(nowMs)
    if (line) this.write(line)
  }
}
