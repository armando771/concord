import type { LoafSummary } from '../../../../../shared/perfLog'

/** Quadro mais lento que isso é "longo" (mesmo corte da API Long Animation Frames). */
const LONG_FRAME_MS = 50
const EMPTY: LoafSummary = { count: 0, maxMs: 0, totalMs: 0 }
const round1 = (value: number): number => Math.round(value * 10) / 10

/** Conta quadros e quadros longos numa janela; `take` entrega a janela e abre a próxima. */
export class FrameStats {
  private frames = 0
  private loaf: LoafSummary = EMPTY

  constructor(private startedMs: number) {}

  frame(): void {
    this.frames += 1
  }

  longFrame(durationMs: number): void {
    if (durationMs <= LONG_FRAME_MS) return
    this.loaf = {
      count: this.loaf.count + 1,
      maxMs: Math.max(this.loaf.maxMs, durationMs),
      totalMs: this.loaf.totalMs + durationMs
    }
  }

  take(nowMs: number): { fps: number; loaf: LoafSummary } {
    const seconds = Math.max((nowMs - this.startedMs) / 1000, 0.001)
    const result = {
      fps: round1(this.frames / seconds),
      loaf: {
        count: this.loaf.count,
        maxMs: round1(this.loaf.maxMs),
        totalMs: round1(this.loaf.totalMs)
      }
    }
    this.startedMs = nowMs
    this.frames = 0
    this.loaf = EMPTY
    return result
  }
}
