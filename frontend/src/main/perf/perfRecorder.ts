import { closeSync, mkdirSync, openSync, writeSync } from 'node:fs'
import { join } from 'node:path'

const pad = (n: number): string => String(n).padStart(2, '0')

export function fileStamp(d: Date): string {
  const date = `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`
  return `${date}-${pad(d.getHours())}${pad(d.getMinutes())}${pad(d.getSeconds())}`
}

/** Grava o JSONL da medição. Uma linha por segundo: escrita síncrona é barata e mantém a ordem. */
export class PerfRecorder {
  private constructor(
    private fd: number | null,
    readonly path: string
  ) {}

  /** Abre `perf-<data>.jsonl` em `dir`; null se não der (a medição simplesmente não liga). */
  static open(dir: string, now: Date): PerfRecorder | null {
    const path = join(dir, `perf-${fileStamp(now)}.jsonl`)
    try {
      mkdirSync(dir, { recursive: true })
      return new PerfRecorder(openSync(path, 'a'), path)
    } catch {
      return null
    }
  }

  write(line: object): void {
    if (this.fd === null) return
    try {
      writeSync(this.fd, `${JSON.stringify(line)}\n`)
    } catch {
      // linha perdida: as próximas tentam de novo
    }
  }

  close(tSec: number): void {
    this.write({ kind: 'end', t: tSec })
    if (this.fd === null) return
    try {
      closeSync(this.fd)
    } catch {
      // já fechado
    }
    this.fd = null
  }
}
