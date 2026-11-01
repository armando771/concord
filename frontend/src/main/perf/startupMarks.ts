import type { StartupLine } from '../../shared/perfLog'

export type StartupMark = 'appReady' | 'readyToShow' | 'usable'

const TOTAL_MARKS = 3
const GIVE_UP_MS = 60_000

/** Tempos de abertura (ms desde o início do processo). */
export class StartupMarks {
  private readonly marks = new Map<StartupMark, number>()
  private taken = false

  mark(name: StartupMark, ms: number): void {
    if (!this.marks.has(name)) this.marks.set(name, Math.round(ms))
  }

  /** A linha de abertura, uma única vez: com os 3 marcos ou depois de 1 minuto. */
  take(nowMs: number): StartupLine | null {
    if (this.taken) return null
    if (this.marks.size < TOTAL_MARKS && nowMs < GIVE_UP_MS) return null
    this.taken = true
    return {
      kind: 'startup',
      appReadyMs: this.marks.get('appReady') ?? null,
      readyToShowMs: this.marks.get('readyToShow') ?? null,
      usableMs: this.marks.get('usable') ?? null
    }
  }
}
