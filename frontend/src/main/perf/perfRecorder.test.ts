import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { fileStamp, PerfRecorder } from './perfRecorder'

let dir = ''
beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'perf-rec-'))
})
afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

const lines = (path: string): unknown[] =>
  readFileSync(path, 'utf8')
    .trim()
    .split('\n')
    .map((l) => JSON.parse(l))

describe('fileStamp', () => {
  it('formata AAAAMMDD-HHmmss com zeros à esquerda', () => {
    expect(fileStamp(new Date(2026, 0, 5, 7, 8, 9))).toBe('20260105-070809')
  })
})

describe('PerfRecorder', () => {
  it('cria a pasta, grava uma linha por write e fecha com end', () => {
    const recorder = PerfRecorder.open(join(dir, 'perf'), new Date(2026, 9, 26, 10, 0, 0))!
    expect(recorder.path.endsWith('perf-20261026-100000.jsonl')).toBe(true)
    recorder.write({ kind: 'sample', t: 1 })
    recorder.write({ kind: 'sample', t: 2 })
    recorder.close(3)
    expect(lines(recorder.path)).toEqual([
      { kind: 'sample', t: 1 },
      { kind: 'sample', t: 2 },
      { kind: 'end', t: 3 }
    ])
  })

  it('depois de fechar, write e close não fazem nada', () => {
    const recorder = PerfRecorder.open(dir, new Date())!
    recorder.close(1)
    recorder.write({ kind: 'sample' })
    recorder.close(2)
    expect(lines(recorder.path)).toEqual([{ kind: 'end', t: 1 }])
  })

  it('devolve null quando não dá para criar a pasta', () => {
    const arquivo = join(dir, 'arquivo')
    writeFileSync(arquivo, 'x')
    expect(PerfRecorder.open(join(arquivo, 'perf'), new Date())).toBeNull()
  })
})
