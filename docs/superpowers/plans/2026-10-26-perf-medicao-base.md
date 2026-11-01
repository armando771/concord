# Medição base de performance — plano de implementação

> **Para agentes:** SUB-SKILL OBRIGATÓRIA: use `superpowers:subagent-driven-development` (recomendado) ou `superpowers:executing-plans` para executar este plano tarefa a tarefa. Os passos usam checkbox (`- [ ]`).

**Objetivo:** com `--perf-log` (ou `SALINHA_PERF_LOG=1`), o app empacotado grava um JSONL com CPU/RAM por tipo de processo, FPS, Long Animation Frames e tempos de abertura; `scripts/perf-report.mjs` resume e compara dois arquivos.

**Arquitetura:** o main amostra `app.getAppMetrics()` a cada 1 s (`main/perf/`), junta o último relatório que o renderer manda por IPC (`perf:report`: rota, estado da chamada, FPS, LoAF) e grava uma linha por amostra. O renderer só observa quando o main responde `true` em `perf:enabled`. Relatório em script puro, testado.

**Stack:** Electron 44 (`app.getAppMetrics`, `ipcMain`), Vitest (frontend), `node:test` (scripts). Sem dependência nova.

## Restrições globais (valem para toda tarefa)

- Spec: [2026-10-26-perf-medicao-base-design.md](../specs/2026-10-26-perf-medicao-base-design.md).
- Código, comentários, docs e commits em **português**; commits convencionais (`feat(perf):`, `docs(perf):`, `test(perf):`).
- **Sem `Co-Authored-By` nem qualquer atribuição a IA** em commits e PR (regra do `AGENTS.md`).
- **CRAP ≤ 15** em toda função tocada; arquivos novos < 400 linhas.
- Sem dependência nova. Sem campo novo em `callStore`/`chatStore`/`serverStore` (só leitura).
- `shared/` não importa de `features/`. Imports relativos.
- Não rode `prettier --write` nem `gofmt -w` em arquivo existente (CRLF).
- Commite **só os arquivos da tarefa** (`git add <caminhos>`), nunca `git add -A`: existe um `frontend/postcss.config.mjs` temporário, não rastreado, que **nunca** entra em commit (ver Tarefa 12).
- Testes do frontend: `cd frontend && npx vitest run <arquivo>`. Testes dos scripts: `node --test scripts/lib/perfReport.test.mjs` (da raiz). Ciclo: `node scripts/affected-tests.mjs loop`.

## Mapa de arquivos

| Arquivo | Responsabilidade |
|---|---|
| `frontend/src/shared/perfLog.ts` | tipos das linhas/eventos, `normalizeRoute`, `parsePerfEvent` |
| `frontend/src/main/perf/perfFlag.ts` | `isPerfLogEnabled(argv, env)` |
| `frontend/src/main/perf/windowState.ts` | `visible` / `minimized` / `tray` a partir da janela |
| `frontend/src/main/perf/processBreakdown.ts` | CPU/RAM por tipo de processo |
| `frontend/src/main/perf/startupMarks.ts` | linha de abertura (3 marcos) |
| `frontend/src/main/perf/perfRecorder.ts` | abre/escreve/fecha o `.jsonl` |
| `frontend/src/main/perf/perfSession.ts` | junta relatório do renderer + amostra do main em linhas |
| `frontend/src/main/perf/setupPerfLog.ts` | ligação com Electron (timer, IPC, `before-quit`) |
| `frontend/src/main/index.ts` | +1 linha (`setupPerfLog`) |
| `frontend/src/preload/index.ts`, `index.d.ts` | `window.api.perf` |
| `frontend/src/renderer/src/shared/lib/perf/frameStats.ts` | FPS e LoAF por janela de 1 s |
| `frontend/src/renderer/src/app/perfContext.ts` | rota + estado da chamada → `PerfContext` |
| `frontend/src/renderer/src/app/perfReporting.ts` | rAF + observer + timer + envio (ligação) |
| `frontend/src/renderer/src/app/PerfBridge.tsx` | monta o `perfReporting` se o main liberar |
| `frontend/src/renderer/src/app/App.tsx` | +`<PerfBridge />` (sem condicional) |
| `scripts/lib/perfReport.mjs` (+`.test.mjs`) | parse, agrupamento, estatística, formatação |
| `scripts/perf-report.mjs` | CLI |
| `docs/PERFORMANCE.md` | roteiro dos cenários e trace do Chromium |

---

### Tarefa 1: tipos, `normalizeRoute` e `parsePerfEvent`

**Arquivos:**
- Criar: `frontend/src/shared/perfLog.ts`
- Teste: `frontend/src/shared/perfLog.test.ts`

**Interfaces:**
- Produz (usadas por todas as tarefas seguintes): `WindowState`, `PerfContext`, `LoafSummary`, `PerfReport`, `PerfMark`, `PerfEvent`, `ProcStat`, `ProcStats`, `SampleLine`, `StartupLine`, `normalizeRoute(path: string): string`, `parsePerfEvent(raw: unknown): PerfEvent | null`.

- [ ] **Passo 1: escrever o teste que falha**

```ts
import { describe, expect, it } from 'vitest'
import { normalizeRoute, parsePerfEvent } from './perfLog'

describe('normalizeRoute', () => {
  it('troca UUIDs e números por :id', () => {
    expect(normalizeRoute('/channels/3f2c9a10-1b2c-4d3e-8f90-a1b2c3d4e5f6/42')).toBe(
      '/channels/:id/:id'
    )
  })

  it('mantém segmentos fixos', () => {
    expect(normalizeRoute('/friends/online')).toBe('/friends/online')
  })

  it('descarta query e hash', () => {
    expect(normalizeRoute('/friends?x=1#topo')).toBe('/friends')
  })

  it('troca códigos longos com número (convite)', () => {
    expect(normalizeRoute('/invite/ab12cd34ef56gh')).toBe('/invite/:id')
  })

  it('é idempotente', () => {
    expect(normalizeRoute('/channels/:id')).toBe('/channels/:id')
  })
})

describe('parsePerfEvent', () => {
  const ctx = { route: '/channels/42', inCall: true, sharing: false, watching: false }

  it('aceita um relatório válido e normaliza a rota', () => {
    const loaf = { count: 1, maxMs: 80, totalMs: 80 }
    expect(parsePerfEvent({ kind: 'report', ctx, fps: 59.5, loaf })).toEqual({
      kind: 'report',
      ctx: { ...ctx, route: '/channels/:id' },
      fps: 59.5,
      loaf
    })
  })

  it('fps e loaf inválidos viram null, sem rejeitar o relatório', () => {
    const parsed = parsePerfEvent({ kind: 'report', ctx, fps: -1, loaf: { count: 'x' } })
    expect(parsed).toMatchObject({ kind: 'report', fps: null, loaf: null })
  })

  it('aceita o marco usable', () => {
    expect(parsePerfEvent({ kind: 'mark', name: 'usable' })).toEqual({
      kind: 'mark',
      name: 'usable'
    })
  })

  it.each([
    null,
    'texto',
    {},
    { kind: 'mark', name: 'outro' },
    { kind: 'report' },
    { kind: 'report', ctx: { route: 1 } }
  ])('rejeita %j', (raw) => {
    expect(parsePerfEvent(raw)).toBeNull()
  })

  it('corta rotas enormes', () => {
    const parsed = parsePerfEvent({ kind: 'report', ctx: { ...ctx, route: `/${'a'.repeat(500)}` } })
    expect(parsed?.kind === 'report' && parsed.ctx.route.length).toBe(200)
  })
})
```

- [ ] **Passo 2: rodar e ver falhar**

Run: `cd frontend && npx vitest run src/shared/perfLog.test.ts`
Expected: FAIL (`Failed to resolve import "./perfLog"`).

- [ ] **Passo 3: implementar**

```ts
/** Linhas do JSONL de performance e o evento que o renderer manda ao main (`--perf-log`). */

export type WindowState = 'visible' | 'minimized' | 'tray'

export interface PerfContext {
  route: string
  inCall: boolean
  sharing: boolean
  watching: boolean
}

export interface LoafSummary {
  count: number
  maxMs: number
  totalMs: number
}

export interface PerfReport {
  kind: 'report'
  ctx: PerfContext
  fps: number | null
  loaf: LoafSummary | null
}

export interface PerfMark {
  kind: 'mark'
  name: 'usable'
}

export type PerfEvent = PerfReport | PerfMark

/** `cpu` é null na primeira amostra (CPU é a diferença entre duas leituras). */
export interface ProcStat {
  cpu: number | null
  memMB: number
}

export type ProcStats = Record<string, ProcStat>

export interface SampleLine {
  t: number
  kind: 'sample'
  ctx: PerfContext & { window: WindowState }
  procs: ProcStats
  fps: number | null
  loaf: LoafSummary | null
}

export interface StartupLine {
  kind: 'startup'
  appReadyMs: number | null
  readyToShowMs: number | null
  usableMs: number | null
}

const MAX_ROUTE = 200
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function isIdSegment(segment: string): boolean {
  if (UUID.test(segment) || /^\d+$/.test(segment)) return true
  return segment.length >= 12 && /\d/.test(segment)
}

/** Troca os IDs da rota por `:id`: o arquivo pode ser compartilhado sem dados pessoais. */
export function normalizeRoute(path: string): string {
  const clean = path.split(/[?#]/)[0]
  return clean
    .split('/')
    .map((segment) => (isIdSegment(segment) ? ':id' : segment))
    .join('/')
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function nonNegative(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0 ? value : null
}

function parseContext(raw: unknown): PerfContext | null {
  if (!isRecord(raw) || typeof raw.route !== 'string') return null
  return {
    route: normalizeRoute(raw.route).slice(0, MAX_ROUTE),
    inCall: raw.inCall === true,
    sharing: raw.sharing === true,
    watching: raw.watching === true
  }
}

function parseLoaf(raw: unknown): LoafSummary | null {
  if (!isRecord(raw)) return null
  const count = nonNegative(raw.count)
  const maxMs = nonNegative(raw.maxMs)
  const totalMs = nonNegative(raw.totalMs)
  if (count === null || maxMs === null || totalMs === null) return null
  return { count, maxMs, totalMs }
}

/** Valida o que veio do renderer (processo menos confiável): formato errado vira null. */
export function parsePerfEvent(raw: unknown): PerfEvent | null {
  if (!isRecord(raw)) return null
  if (raw.kind === 'mark') return raw.name === 'usable' ? { kind: 'mark', name: 'usable' } : null
  if (raw.kind !== 'report') return null
  const ctx = parseContext(raw.ctx)
  if (!ctx) return null
  return { kind: 'report', ctx, fps: nonNegative(raw.fps), loaf: parseLoaf(raw.loaf) }
}
```

- [ ] **Passo 4: rodar e ver passar**

Run: `cd frontend && npx vitest run src/shared/perfLog.test.ts`
Expected: PASS (todos).

- [ ] **Passo 5: commit**

```bash
git add frontend/src/shared/perfLog.ts frontend/src/shared/perfLog.test.ts
git commit -m "feat(perf): tipos do log de performance e validação do evento do renderer"
```

---

### Tarefa 2: flag e estado da janela

**Arquivos:**
- Criar: `frontend/src/main/perf/perfFlag.ts`, `frontend/src/main/perf/windowState.ts`
- Teste: `frontend/src/main/perf/perfFlag.test.ts`, `frontend/src/main/perf/windowState.test.ts`

**Interfaces:**
- Consome: `WindowState` (Tarefa 1).
- Produz: `isPerfLogEnabled(argv: readonly string[], env: Record<string, string | undefined>): boolean`, `windowState(win: WindowLike | null): WindowState`.

- [ ] **Passo 1: escrever os testes que falham**

`perfFlag.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { isPerfLogEnabled } from './perfFlag'

describe('isPerfLogEnabled', () => {
  it('liga com --perf-log no argv', () => {
    expect(isPerfLogEnabled(['Salinha.exe', '--perf-log'], {})).toBe(true)
  })

  it('liga com SALINHA_PERF_LOG=1', () => {
    expect(isPerfLogEnabled(['Salinha.exe'], { SALINHA_PERF_LOG: '1' })).toBe(true)
  })

  it('fica desligado sem nenhum dos dois', () => {
    expect(isPerfLogEnabled(['Salinha.exe'], {})).toBe(false)
    expect(isPerfLogEnabled(['Salinha.exe'], { SALINHA_PERF_LOG: '0' })).toBe(false)
    expect(isPerfLogEnabled(['Salinha.exe'], { SALINHA_PERF_LOG: '' })).toBe(false)
  })
})
```

`windowState.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { windowState } from './windowState'

const win = (destroyed: boolean, minimized: boolean, visible: boolean) => ({
  isDestroyed: () => destroyed,
  isMinimized: () => minimized,
  isVisible: () => visible
})

describe('windowState', () => {
  it('visível', () => expect(windowState(win(false, false, true))).toBe('visible'))
  it('minimizada', () => expect(windowState(win(false, true, false))).toBe('minimized'))
  it('oculta (bandeja)', () => expect(windowState(win(false, false, false))).toBe('tray'))
  it('sem janela ou destruída conta como bandeja', () => {
    expect(windowState(null)).toBe('tray')
    expect(windowState(win(true, false, true))).toBe('tray')
  })
})
```

- [ ] **Passo 2: rodar e ver falhar**

Run: `cd frontend && npx vitest run src/main/perf/perfFlag.test.ts src/main/perf/windowState.test.ts`
Expected: FAIL (módulos não existem).

- [ ] **Passo 3: implementar**

`perfFlag.ts`:
```ts
/** `--perf-log` no argv ou `SALINHA_PERF_LOG=1` ligam a medição (só para dev). */
export function isPerfLogEnabled(
  argv: readonly string[],
  env: Record<string, string | undefined>
): boolean {
  return argv.includes('--perf-log') || env.SALINHA_PERF_LOG === '1'
}
```

`windowState.ts`:
```ts
import type { WindowState } from '../../shared/perfLog'

interface WindowLike {
  isDestroyed(): boolean
  isMinimized(): boolean
  isVisible(): boolean
}

/** Minimizada é checada antes de visível: no Windows a minimizada não conta como visível. */
export function windowState(win: WindowLike | null): WindowState {
  if (!win || win.isDestroyed()) return 'tray'
  if (win.isMinimized()) return 'minimized'
  return win.isVisible() ? 'visible' : 'tray'
}
```

- [ ] **Passo 4: rodar e ver passar**

Run: `cd frontend && npx vitest run src/main/perf/perfFlag.test.ts src/main/perf/windowState.test.ts`
Expected: PASS.

- [ ] **Passo 5: commit**

```bash
git add frontend/src/main/perf/perfFlag.ts frontend/src/main/perf/perfFlag.test.ts frontend/src/main/perf/windowState.ts frontend/src/main/perf/windowState.test.ts
git commit -m "feat(perf): flag --perf-log e estado da janela (visível, minimizada, bandeja)"
```

---

### Tarefa 3: CPU/RAM por tipo de processo

**Arquivos:**
- Criar: `frontend/src/main/perf/processBreakdown.ts`
- Teste: `frontend/src/main/perf/processBreakdown.test.ts`

**Interfaces:**
- Consome: `ProcStats` (Tarefa 1); `AppMetricsSampler` de `../app/appMetrics` (existente: `sample(readings, time, cores, reset?) → { memoryMB: number | null; cpuPercent: number | null }`, `time` em ms).
- Produz: `class ProcessBreakdown { sample(readings: Reading[], time: number, cores: number): ProcStats }`, com `Reading = Pick<ProcessMetric, 'pid' | 'creationTime' | 'memory' | 'cpu' | 'type'>`. Grupos: `Browser`, `Tab`, `GPU`, `Utility`, `Other` (qualquer outro tipo). Grupo sem processo não aparece no resultado.

- [ ] **Passo 1: escrever o teste que falha**

```ts
import { describe, expect, it, vi } from 'vitest'
import type { ProcessMetric } from 'electron'

vi.mock('electron', () => ({ app: {}, ipcMain: {} }))

import { ProcessBreakdown } from './processBreakdown'

function proc(pid: number, type: string, cpu: number, memKB = 1024): ProcessMetric {
  return {
    pid,
    type,
    creationTime: 0,
    cpu: { cumulativeCPUUsage: cpu },
    memory: { workingSetSize: memKB }
  } as ProcessMetric
}

describe('ProcessBreakdown', () => {
  it('agrupa por tipo, soma a memória e deixa a CPU null na primeira amostra', () => {
    const stats = new ProcessBreakdown().sample(
      [proc(1, 'Browser', 1), proc(2, 'Tab', 2), proc(3, 'Tab', 3)],
      0,
      4
    )
    expect(stats).toEqual({
      Browser: { cpu: null, memMB: 1 },
      Tab: { cpu: null, memMB: 2 }
    })
  })

  it('calcula a CPU de cada grupo pela diferença entre duas leituras', () => {
    const breakdown = new ProcessBreakdown()
    breakdown.sample([proc(1, 'Browser', 1), proc(2, 'Tab', 2)], 0, 4)
    const stats = breakdown.sample([proc(1, 'Browser', 1.1), proc(2, 'Tab', 2.3)], 1000, 4)
    // 0,1 s e 0,3 s de CPU em 1 s, divididos por 4 núcleos
    expect(stats.Browser.cpu).toBe(2.5)
    expect(stats.Tab.cpu).toBe(7.5)
  })

  it('processo novo no meio não gera pico de CPU', () => {
    const breakdown = new ProcessBreakdown()
    breakdown.sample([proc(2, 'Tab', 2)], 0, 4)
    const stats = breakdown.sample([proc(2, 'Tab', 2.3), proc(9, 'Tab', 50)], 1000, 4)
    expect(stats.Tab.cpu).toBe(7.5)
  })

  it('tipos fora da lista caem em Other e grupo sem processo some', () => {
    const stats = new ProcessBreakdown().sample([proc(1, 'Zygote', 1), proc(2, 'Utility', 1)], 0, 1)
    expect(Object.keys(stats).sort()).toEqual(['Other', 'Utility'])
  })
})
```

- [ ] **Passo 2: rodar e ver falhar**

Run: `cd frontend && npx vitest run src/main/perf/processBreakdown.test.ts`
Expected: FAIL (módulo não existe).

- [ ] **Passo 3: implementar**

```ts
import type { ProcessMetric } from 'electron'
import type { ProcStats } from '../../shared/perfLog'
import { AppMetricsSampler } from '../app/appMetrics'

type Reading = Pick<ProcessMetric, 'pid' | 'creationTime' | 'memory' | 'cpu' | 'type'>

const GROUPS = ['Browser', 'Tab', 'GPU', 'Utility', 'Other']

const groupOf = (type: string): string => (GROUPS.includes(type) ? type : 'Other')
const round1 = (value: number): number => Math.round(value * 10) / 10

/** CPU e RAM do app separados por tipo de processo (um sampler por tipo). */
export class ProcessBreakdown {
  private readonly samplers = new Map(GROUPS.map((name) => [name, new AppMetricsSampler()]))

  sample(readings: Reading[], time: number, cores: number): ProcStats {
    const byGroup = new Map<string, Reading[]>()
    for (const reading of readings) {
      const group = groupOf(reading.type)
      byGroup.set(group, [...(byGroup.get(group) ?? []), reading])
    }
    const stats: ProcStats = {}
    for (const [group, sampler] of this.samplers) {
      const metrics = sampler.sample(byGroup.get(group) ?? [], time, cores)
      if (metrics.memoryMB === null) continue
      stats[group] = {
        cpu: metrics.cpuPercent === null ? null : round1(metrics.cpuPercent),
        memMB: round1(metrics.memoryMB)
      }
    }
    return stats
  }
}
```

- [ ] **Passo 4: rodar e ver passar**

Run: `cd frontend && npx vitest run src/main/perf/processBreakdown.test.ts`
Expected: PASS.

- [ ] **Passo 5: commit**

```bash
git add frontend/src/main/perf/processBreakdown.ts frontend/src/main/perf/processBreakdown.test.ts
git commit -m "feat(perf): CPU e RAM por tipo de processo"
```

---

### Tarefa 4: marcos de abertura

**Arquivos:**
- Criar: `frontend/src/main/perf/startupMarks.ts`
- Teste: `frontend/src/main/perf/startupMarks.test.ts`

**Interfaces:**
- Consome: `StartupLine` (Tarefa 1).
- Produz: `type StartupMark = 'appReady' | 'readyToShow' | 'usable'`, `class StartupMarks { mark(name: StartupMark, ms: number): void; take(nowMs: number): StartupLine | null }`. `take` devolve a linha **uma única vez**: quando os 3 marcos chegaram ou quando `nowMs >= 60000`; depois disso devolve `null`.

- [ ] **Passo 1: escrever o teste que falha**

```ts
import { describe, expect, it } from 'vitest'
import { StartupMarks } from './startupMarks'

describe('StartupMarks', () => {
  it('só entrega a linha quando os três marcos chegaram', () => {
    const marks = new StartupMarks()
    marks.mark('appReady', 310.4)
    marks.mark('readyToShow', 1240)
    expect(marks.take(2000)).toBeNull()
    marks.mark('usable', 2050)
    expect(marks.take(2100)).toEqual({
      kind: 'startup',
      appReadyMs: 310,
      readyToShowMs: 1240,
      usableMs: 2050
    })
  })

  it('aceita usable chegando antes do ready-to-show', () => {
    const marks = new StartupMarks()
    marks.mark('appReady', 100)
    marks.mark('usable', 900)
    marks.mark('readyToShow', 1200)
    expect(marks.take(1300)).toMatchObject({ readyToShowMs: 1200, usableMs: 900 })
  })

  it('passado 1 minuto entrega com o marco que faltou como null', () => {
    const marks = new StartupMarks()
    marks.mark('appReady', 100)
    marks.mark('readyToShow', 800)
    expect(marks.take(59_999)).toBeNull()
    expect(marks.take(60_000)).toEqual({
      kind: 'startup',
      appReadyMs: 100,
      readyToShowMs: 800,
      usableMs: null
    })
  })

  it('entrega uma vez só e ignora marco repetido', () => {
    const marks = new StartupMarks()
    marks.mark('appReady', 100)
    marks.mark('appReady', 5000)
    marks.mark('readyToShow', 200)
    marks.mark('usable', 300)
    expect(marks.take(400)).toMatchObject({ appReadyMs: 100 })
    expect(marks.take(500)).toBeNull()
  })
})
```

- [ ] **Passo 2: rodar e ver falhar**

Run: `cd frontend && npx vitest run src/main/perf/startupMarks.test.ts`
Expected: FAIL.

- [ ] **Passo 3: implementar**

```ts
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
```

- [ ] **Passo 4: rodar e ver passar**

Run: `cd frontend && npx vitest run src/main/perf/startupMarks.test.ts`
Expected: PASS.

- [ ] **Passo 5: commit**

```bash
git add frontend/src/main/perf/startupMarks.ts frontend/src/main/perf/startupMarks.test.ts
git commit -m "feat(perf): marcos de abertura do app"
```

---

### Tarefa 5: gravador do JSONL

**Arquivos:**
- Criar: `frontend/src/main/perf/perfRecorder.ts`
- Teste: `frontend/src/main/perf/perfRecorder.test.ts`

**Interfaces:**
- Produz: `fileStamp(d: Date): string` (`AAAAMMDD-HHmmss`), `class PerfRecorder { static open(dir: string, now: Date): PerfRecorder | null; readonly path: string; write(line: object): void; close(tSec: number): void }`. `close` grava `{"kind":"end","t":tSec}` e fecha; depois disso `write` não faz nada.

- [ ] **Passo 1: escrever o teste que falha**

```ts
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
  readFileSync(path, 'utf8').trim().split('\n').map((l) => JSON.parse(l))

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
```

- [ ] **Passo 2: rodar e ver falhar**

Run: `cd frontend && npx vitest run src/main/perf/perfRecorder.test.ts`
Expected: FAIL.

- [ ] **Passo 3: implementar**

```ts
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
```

- [ ] **Passo 4: rodar e ver passar**

Run: `cd frontend && npx vitest run src/main/perf/perfRecorder.test.ts`
Expected: PASS.

- [ ] **Passo 5: commit**

```bash
git add frontend/src/main/perf/perfRecorder.ts frontend/src/main/perf/perfRecorder.test.ts
git commit -m "feat(perf): gravador do arquivo JSONL de medição"
```

---

### Tarefa 6: sessão (junta relatório do renderer e amostra do main)

**Arquivos:**
- Criar: `frontend/src/main/perf/perfSession.ts`
- Teste: `frontend/src/main/perf/perfSession.test.ts`

**Interfaces:**
- Consome: `PerfEvent`, `PerfContext`, `PerfReport`, `SampleLine`, `WindowState` (Tarefa 1); `ProcessBreakdown` (Tarefa 3); `StartupMarks`, `StartupMark` (Tarefa 4).
- Produz: `class PerfSession { constructor(write: (line: object) => void, cores: number); mark(name: StartupMark, nowMs: number): void; receive(event: PerfEvent, nowMs: number): void; sample(readings: Reading[], window: WindowState, nowMs: number): void }`. `nowMs` é sempre `process.uptime() * 1000`. Relatório com mais de 2 s deixa `fps` e `loaf` como `null` (a rota e as flags do último relatório continuam valendo); sem nenhum relatório, o contexto é `route: ''` e flags `false`. A linha `startup` sai pela própria sessão assim que `StartupMarks.take` liberar (em `mark` e em `sample`).

- [ ] **Passo 1: escrever o teste que falha**

```ts
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ProcessMetric } from 'electron'

vi.mock('electron', () => ({ app: {}, ipcMain: {} }))

import type { PerfReport } from '../../shared/perfLog'
import { PerfSession } from './perfSession'

const tab = (cpu: number): ProcessMetric =>
  ({
    pid: 2,
    type: 'Tab',
    creationTime: 0,
    cpu: { cumulativeCPUUsage: cpu },
    memory: { workingSetSize: 2048 }
  }) as ProcessMetric

const report = (route = '/channels/:id'): PerfReport => ({
  kind: 'report',
  ctx: { route, inCall: true, sharing: false, watching: false },
  fps: 60,
  loaf: { count: 1, maxMs: 80, totalMs: 80 }
})

let lines: Array<Record<string, any>>
let session: PerfSession
beforeEach(() => {
  lines = []
  session = new PerfSession((line) => lines.push(line as Record<string, any>), 4)
})

describe('PerfSession.sample', () => {
  it('sem relatório do renderer usa contexto vazio e fps/loaf null', () => {
    session.sample([tab(1)], 'visible', 1000)
    expect(lines[0]).toMatchObject({
      kind: 'sample',
      t: 1,
      ctx: { window: 'visible', route: '', inCall: false, sharing: false, watching: false },
      procs: { Tab: { cpu: null, memMB: 2 } },
      fps: null,
      loaf: null
    })
  })

  it('usa o último relatório quando é recente', () => {
    session.receive(report(), 1000)
    session.sample([tab(1)], 'tray', 2500)
    expect(lines[0]).toMatchObject({
      ctx: { window: 'tray', route: '/channels/:id', inCall: true },
      fps: 60,
      loaf: { count: 1, maxMs: 80, totalMs: 80 }
    })
  })

  it('relatório com mais de 2 s zera fps/loaf mas mantém a rota', () => {
    session.receive(report(), 1000)
    session.sample([tab(1)], 'minimized', 3001)
    expect(lines[0]).toMatchObject({
      ctx: { window: 'minimized', route: '/channels/:id' },
      fps: null,
      loaf: null
    })
  })
})

describe('PerfSession: abertura', () => {
  it('escreve a linha startup quando os três marcos chegam', () => {
    session.mark('appReady', 300)
    session.mark('readyToShow', 1200)
    expect(lines).toHaveLength(0)
    session.receive({ kind: 'mark', name: 'usable' }, 2000)
    expect(lines).toEqual([
      { kind: 'startup', appReadyMs: 300, readyToShowMs: 1200, usableMs: 2000 }
    ])
  })

  it('escreve a linha startup num sample depois de 1 minuto, mesmo sem usable', () => {
    session.mark('appReady', 300)
    session.sample([tab(1)], 'visible', 60_000)
    expect(lines.map((l) => l.kind)).toEqual(['sample', 'startup'])
    expect(lines[1]).toMatchObject({ usableMs: null })
  })
})
```

- [ ] **Passo 2: rodar e ver falhar**

Run: `cd frontend && npx vitest run src/main/perf/perfSession.test.ts`
Expected: FAIL.

- [ ] **Passo 3: implementar**

```ts
import type { ProcessMetric } from 'electron'
import type { PerfContext, PerfEvent, PerfReport, SampleLine, WindowState } from '../../shared/perfLog'
import { ProcessBreakdown } from './processBreakdown'
import { StartupMarks, type StartupMark } from './startupMarks'

type Reading = Pick<ProcessMetric, 'pid' | 'creationTime' | 'memory' | 'cpu' | 'type'>

/** FPS e LoAF de um relatório mais velho que isso não valem para a amostra. */
const STALE_MS = 2000
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
    const fresh = last !== null && nowMs - last.atMs <= STALE_MS ? last.report : null
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
```

- [ ] **Passo 4: rodar e ver passar**

Run: `cd frontend && npx vitest run src/main/perf/perfSession.test.ts`
Expected: PASS.

- [ ] **Passo 5: commit**

```bash
git add frontend/src/main/perf/perfSession.ts frontend/src/main/perf/perfSession.test.ts
git commit -m "feat(perf): sessão que junta o relatório do renderer e a amostra do main"
```

---

### Tarefa 7: ligação com o Electron (`setupPerfLog`) e `main/index.ts`

**Arquivos:**
- Criar: `frontend/src/main/perf/setupPerfLog.ts`
- Teste: `frontend/src/main/perf/setupPerfLog.test.ts`
- Modificar: `frontend/src/main/index.ts` (import + 1 linha no `whenReady`)

**Interfaces:**
- Consome: `isPerfLogEnabled` (T2), `windowState` (T2), `PerfRecorder` (T5), `PerfSession` (T6), `parsePerfEvent` (T1), `appendLog(name, message)` de `../app/appLog`.
- Produz: `setupPerfLog(getWindow: () => BrowserWindow | null): void`. Sempre registra `ipcMain.handle('perf:enabled', () => boolean)` (`true` só se a gravação abriu). Com a flag: registra `ipcMain.on('perf:report', …)` (ignora `sender` ≠ `win.webContents`, `senderFrame` ≠ `mainFrame` e formato inválido), `app.on('browser-window-created')` → `readyToShow` da janela principal, `setInterval` de 1 s com `app.getAppMetrics()`, e `app.once('before-quit')` que para o timer e fecha o arquivo.

- [ ] **Passo 1: escrever o teste que falha**

```ts
import { mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { BrowserWindow } from 'electron'

type Fn = (...args: any[]) => any
const electron = vi.hoisted(() => ({
  handlers: new Map<string, Fn>(),
  listeners: new Map<string, Fn>(),
  appListeners: new Map<string, Fn>(),
  userData: ''
}))

vi.mock('electron', () => ({
  app: {
    getPath: () => electron.userData,
    getAppMetrics: () => [],
    on: (name: string, cb: Fn) => electron.appListeners.set(name, cb),
    once: (name: string, cb: Fn) => electron.appListeners.set(name, cb)
  },
  ipcMain: {
    handle: (name: string, cb: Fn) => electron.handlers.set(name, cb),
    on: (name: string, cb: Fn) => electron.listeners.set(name, cb)
  }
}))
vi.mock('../app/appLog', () => ({ appendLog: vi.fn() }))

import { setupPerfLog } from './setupPerfLog'

const webContents = { mainFrame: {} }
const win = {
  isDestroyed: () => false,
  isMinimized: () => false,
  isVisible: () => true,
  webContents
} as unknown as BrowserWindow

const report = {
  kind: 'report',
  ctx: { route: '/channels/42', inCall: false, sharing: false, watching: false },
  fps: 60,
  loaf: { count: 0, maxMs: 0, totalMs: 0 }
}
const fromWindow = { sender: webContents, senderFrame: webContents.mainFrame }

function readLog(): Array<Record<string, any>> {
  const dir = join(electron.userData, 'perf')
  const [file] = readdirSync(dir)
  return readFileSync(join(dir, file), 'utf8').trim().split('\n').map((l) => JSON.parse(l))
}

beforeEach(() => {
  electron.handlers.clear()
  electron.listeners.clear()
  electron.appListeners.clear()
  electron.userData = mkdtempSync(join(tmpdir(), 'perf-setup-'))
  vi.useFakeTimers()
})
afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllEnvs()
  rmSync(electron.userData, { recursive: true, force: true })
})

describe('setupPerfLog', () => {
  it('sem a flag: responde false e não cria timer, listener nem arquivo', async () => {
    vi.stubEnv('SALINHA_PERF_LOG', '')
    setupPerfLog(() => win)
    expect(await electron.handlers.get('perf:enabled')!()).toBe(false)
    expect(electron.listeners.size).toBe(0)
    expect(electron.appListeners.size).toBe(0)
    expect(vi.getTimerCount()).toBe(0)
    expect(readdirSync(electron.userData)).toEqual([])
  })

  it('com a flag: grava amostras com o contexto do renderer e fecha com end', async () => {
    vi.stubEnv('SALINHA_PERF_LOG', '1')
    setupPerfLog(() => win)
    expect(await electron.handlers.get('perf:enabled')!()).toBe(true)

    electron.listeners.get('perf:report')!(fromWindow, report)
    vi.advanceTimersByTime(1000)
    electron.appListeners.get('before-quit')!()

    const lines = readLog()
    expect(lines[0]).toMatchObject({
      kind: 'sample',
      ctx: { window: 'visible', route: '/channels/:id' },
      fps: 60
    })
    expect(lines.at(-1)).toMatchObject({ kind: 'end' })
    expect(vi.getTimerCount()).toBe(0)
  })

  it('ignora relatório de outro sender e de outro frame', () => {
    vi.stubEnv('SALINHA_PERF_LOG', '1')
    setupPerfLog(() => win)
    electron.listeners.get('perf:report')!({ sender: {}, senderFrame: webContents.mainFrame }, report)
    electron.listeners.get('perf:report')!({ sender: webContents, senderFrame: {} }, report)
    vi.advanceTimersByTime(1000)
    electron.appListeners.get('before-quit')!()
    expect(readLog()[0]).toMatchObject({ ctx: { route: '' }, fps: null })
  })

  it('ignora relatório com formato inválido', () => {
    vi.stubEnv('SALINHA_PERF_LOG', '1')
    setupPerfLog(() => win)
    electron.listeners.get('perf:report')!(fromWindow, { kind: 'report', ctx: 7 })
    vi.advanceTimersByTime(1000)
    electron.appListeners.get('before-quit')!()
    expect(readLog()[0]).toMatchObject({ fps: null })
  })
})
```

- [ ] **Passo 2: rodar e ver falhar**

Run: `cd frontend && npx vitest run src/main/perf/setupPerfLog.test.ts`
Expected: FAIL (módulo não existe).

- [ ] **Passo 3: implementar `setupPerfLog.ts`**

```ts
import { app, ipcMain, type BrowserWindow } from 'electron'
import { cpus } from 'node:os'
import { join } from 'node:path'
import { parsePerfEvent } from '../../shared/perfLog'
import { appendLog } from '../app/appLog'
import { isPerfLogEnabled } from './perfFlag'
import { PerfRecorder } from './perfRecorder'
import { PerfSession } from './perfSession'
import { windowState } from './windowState'

const SAMPLE_MS = 1000
const nowMs = (): number => process.uptime() * 1000

type GetWindow = () => BrowserWindow | null

/** O ready-to-show da janela principal (a de overlay também dispara; só a principal conta). */
function watchReadyToShow(getWindow: GetWindow, session: PerfSession): void {
  app.on('browser-window-created', (_event, win) => {
    win.once('ready-to-show', () => {
      if (win === getWindow()) session.mark('readyToShow', nowMs())
    })
  })
}

/** Relatórios do renderer: mesma checagem de origem do app-metrics:sample. */
function listenReports(getWindow: GetWindow, session: PerfSession): void {
  ipcMain.on('perf:report', (event, raw: unknown) => {
    const win = getWindow()
    if (!win || win.isDestroyed() || event.sender !== win.webContents) return
    if (event.senderFrame !== win.webContents.mainFrame) return
    const parsed = parsePerfEvent(raw)
    if (parsed) session.receive(parsed, nowMs())
  })
}

function startRecording(getWindow: GetWindow): boolean {
  const recorder = PerfRecorder.open(join(app.getPath('userData'), 'perf'), new Date())
  if (!recorder) {
    appendLog('perf.log', 'não foi possível abrir o arquivo de medição: --perf-log desligado')
    return false
  }
  const session = new PerfSession((line) => recorder.write(line), cpus().length)
  session.mark('appReady', nowMs())
  watchReadyToShow(getWindow, session)
  listenReports(getWindow, session)
  const timer = setInterval(
    () => session.sample(app.getAppMetrics(), windowState(getWindow()), nowMs()),
    SAMPLE_MS
  )
  app.once('before-quit', () => {
    clearInterval(timer)
    recorder.close(Math.round(nowMs() / 100) / 10)
  })
  return true
}

/**
 * Medição de performance para dev (`--perf-log` ou `SALINHA_PERF_LOG=1`): grava um JSONL
 * em userData/perf. Sem a flag só responde `false` a `perf:enabled`; nada mais roda.
 * Chamar como PRIMEIRA coisa do whenReady, para o `appReady` refletir a abertura real.
 */
export function setupPerfLog(getWindow: GetWindow): void {
  const started = isPerfLogEnabled(process.argv, process.env) && startRecording(getWindow)
  ipcMain.handle('perf:enabled', () => started)
}
```

- [ ] **Passo 4: rodar e ver passar**

Run: `cd frontend && npx vitest run src/main/perf/setupPerfLog.test.ts`
Expected: PASS (4 testes).

- [ ] **Passo 5: ligar no `main/index.ts`**

Em `frontend/src/main/index.ts`:
1. junto dos outros imports de `./app/...`/`./window/...` (ordem alfabética não é exigida), acrescente: `import { setupPerfLog } from './perf/setupPerfLog'`
2. no `app.whenReady().then(() => {`, **antes** de `electronApp.setAppUserModelId(APP_USER_MODEL_ID)`, acrescente:
```ts
  // Primeiro de tudo: o tempo de abertura medido começa daqui. Sem --perf-log não faz nada.
  setupPerfLog(() => mainWindow)
```
Edite com o `Edit` (linhas exatas), sem formatador; o arquivo é CRLF.

- [ ] **Passo 6: typecheck e contagem de linhas**

Run: `cd frontend && npm run typecheck:node && wc -l src/main/index.ts`
Expected: sem erros; `index.ts` com 380 linhas (< 400).

- [ ] **Passo 7: commit**

```bash
git add frontend/src/main/perf/setupPerfLog.ts frontend/src/main/perf/setupPerfLog.test.ts frontend/src/main/index.ts
git commit -m "feat(perf): liga a medição ao Electron com --perf-log"
```

---

### Tarefa 8: ponte no preload

**Arquivos:**
- Modificar: `frontend/src/preload/index.ts`, `frontend/src/preload/index.d.ts`

**Interfaces:**
- Consome: `PerfEvent` (T1); canais `perf:enabled` (invoke) e `perf:report` (send) da Tarefa 7.
- Produz: `window.api?.perf?: { enabled(): Promise<boolean>; report(event: PerfEvent): void }`.

Sem lógica nova (as funções têm complexidade 1), então não há teste de unidade; o typecheck e a verificação de ponta a ponta (Tarefa 12) cobrem.

- [ ] **Passo 1: `preload/index.ts`**

Acrescente o import `import type { PerfEvent } from '../shared/perfLog'` junto de `import type { AppMetrics } ...` e, no objeto `api`, logo depois do bloco `appMetrics`:
```ts
  perf: {
    /** O main responde true só quando o app foi aberto com --perf-log. */
    enabled(): Promise<boolean> {
      return ipcRenderer.invoke('perf:enabled')
    },
    report(event: PerfEvent): void {
      ipcRenderer.send('perf:report', event)
    }
  },
```

- [ ] **Passo 2: `preload/index.d.ts`**

Acrescente `import type { PerfEvent } from '../shared/perfLog'` junto de `import type { AppMetrics } ...` e, ao lado da linha `appMetrics?: { sample(reset?: boolean): Promise<AppMetrics | null> }`:
```ts
      perf?: { enabled(): Promise<boolean>; report(event: PerfEvent): void }
```

- [ ] **Passo 3: typecheck**

Run: `cd frontend && npm run typecheck`
Expected: sem erros.

- [ ] **Passo 4: commit**

```bash
git add frontend/src/preload/index.ts frontend/src/preload/index.d.ts
git commit -m "feat(perf): window.api.perf no preload"
```

---

### Tarefa 9: FPS e Long Animation Frames (renderer)

**Arquivos:**
- Criar: `frontend/src/renderer/src/shared/lib/perf/frameStats.ts`
- Teste: `frontend/src/renderer/src/shared/lib/perf/frameStats.test.ts`

**Interfaces:**
- Consome: `LoafSummary` de `../../../../../shared/perfLog`.
- Produz: `class FrameStats { constructor(startedMs: number); frame(): void; longFrame(durationMs: number): void; take(nowMs: number): { fps: number; loaf: LoafSummary } }`. `take` fecha a janela atual e começa outra. `longFrame` ignora duração ≤ 50 ms.

- [ ] **Passo 1: escrever o teste que falha**

```ts
import { describe, expect, it } from 'vitest'
import { FrameStats } from './frameStats'

describe('FrameStats', () => {
  it('FPS = quadros / segundos da janela', () => {
    const stats = new FrameStats(0)
    for (let i = 0; i < 60; i++) stats.frame()
    expect(stats.take(1000).fps).toBe(60)
  })

  it('a janela reinicia a cada take', () => {
    const stats = new FrameStats(0)
    for (let i = 0; i < 30; i++) stats.frame()
    stats.take(1000)
    for (let i = 0; i < 10; i++) stats.frame()
    expect(stats.take(3000).fps).toBe(5)
  })

  it('LoAF: conta, maior e soma só dos quadros acima de 50 ms', () => {
    const stats = new FrameStats(0)
    stats.longFrame(50)
    stats.longFrame(51.26)
    stats.longFrame(120)
    expect(stats.take(1000).loaf).toEqual({ count: 2, maxMs: 120, totalMs: 171.3 })
  })

  it('o LoAF também zera entre janelas', () => {
    const stats = new FrameStats(0)
    stats.longFrame(100)
    stats.take(1000)
    expect(stats.take(2000).loaf).toEqual({ count: 0, maxMs: 0, totalMs: 0 })
  })

  it('janela de duração zero não divide por zero', () => {
    const stats = new FrameStats(500)
    stats.frame()
    expect(Number.isFinite(stats.take(500).fps)).toBe(true)
  })
})
```

- [ ] **Passo 2: rodar e ver falhar**

Run: `cd frontend && npx vitest run src/renderer/src/shared/lib/perf/frameStats.test.ts`
Expected: FAIL.

- [ ] **Passo 3: implementar**

```ts
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
```

- [ ] **Passo 4: rodar e ver passar**

Run: `cd frontend && npx vitest run src/renderer/src/shared/lib/perf/frameStats.test.ts`
Expected: PASS.

- [ ] **Passo 5: commit**

```bash
git add frontend/src/renderer/src/shared/lib/perf/frameStats.ts frontend/src/renderer/src/shared/lib/perf/frameStats.test.ts
git commit -m "feat(perf): FPS e Long Animation Frames por janela de 1 s"
```

---

### Tarefa 10: contexto, reporte e `PerfBridge` no renderer

**Arquivos:**
- Criar: `frontend/src/renderer/src/app/perfContext.ts`, `perfContext.test.ts`, `perfReporting.ts`, `PerfBridge.tsx`
- Modificar: `frontend/src/renderer/src/app/App.tsx`

**Interfaces:**
- Consome: `PerfContext`, `PerfReport`, `PerfEvent`, `normalizeRoute` (T1); `FrameStats` (T9); `window.api.perf` (T8); `useCallStore` (somente leitura: `status`, `isScreenSharing`, `watchedScreenIds`), `useServerStore` (somente leitura: `serversLoaded`), `router` de `./router`.
- Produz: `buildPerfContext(pathname: string, call: { status: string; isScreenSharing: boolean; watchedScreenIds: string[] }): PerfContext` (`inCall` = `status === 'active'`), `startPerfReporting(send: (event: PerfEvent) => void): () => void` (devolve a função que desliga tudo), componente `PerfBridge` (default export).

- [ ] **Passo 1: escrever o teste de `perfContext` (falha)**

`perfContext.test.ts`:
```ts
import { describe, expect, it } from 'vitest'
import { buildPerfContext } from './perfContext'

const idle = { status: 'idle', isScreenSharing: false, watchedScreenIds: [] as string[] }

describe('buildPerfContext', () => {
  it('normaliza a rota e deixa as flags desligadas fora de chamada', () => {
    expect(buildPerfContext('/channels/42', idle)).toEqual({
      route: '/channels/:id',
      inCall: false,
      sharing: false,
      watching: false
    })
  })

  it('só chamada ativa conta como inCall', () => {
    expect(buildPerfContext('/', { ...idle, status: 'active' }).inCall).toBe(true)
    expect(buildPerfContext('/', { ...idle, status: 'ringing' }).inCall).toBe(false)
    expect(buildPerfContext('/', { ...idle, status: 'outgoing' }).inCall).toBe(false)
  })

  it('transmitindo e assistindo vêm do estado da chamada', () => {
    const ctx = buildPerfContext('/', { status: 'active', isScreenSharing: true, watchedScreenIds: ['u1'] })
    expect(ctx).toMatchObject({ sharing: true, watching: true })
  })
})
```

- [ ] **Passo 2: rodar e ver falhar**

Run: `cd frontend && npx vitest run src/renderer/src/app/perfContext.test.ts`
Expected: FAIL.

- [ ] **Passo 3: implementar `perfContext.ts`**

```ts
import { normalizeRoute, type PerfContext } from '../../../shared/perfLog'

interface CallSnapshot {
  status: string
  isScreenSharing: boolean
  watchedScreenIds: string[]
}

/** O que o relatório de performance precisa saber do estado atual do app. */
export function buildPerfContext(pathname: string, call: CallSnapshot): PerfContext {
  return {
    route: normalizeRoute(pathname),
    inCall: call.status === 'active',
    sharing: call.isScreenSharing,
    watching: call.watchedScreenIds.length > 0
  }
}
```

- [ ] **Passo 4: implementar `perfReporting.ts`**

```ts
import type { PerfEvent, PerfReport } from '../../../shared/perfLog'
import { useCallStore } from '../features/call/store/callStore'
import { useServerStore } from '../features/servers/store/serverStore'
import { FrameStats } from '../shared/lib/perf/frameStats'
import { buildPerfContext } from './perfContext'
import { router } from './router'

const REPORT_MS = 1000

/** null quando o Chromium não suporta Long Animation Frames. */
function observeLongFrames(onDuration: (ms: number) => void): PerformanceObserver | null {
  if (!PerformanceObserver.supportedEntryTypes?.includes('long-animation-frame')) return null
  const observer = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) onDuration(entry.duration)
  })
  observer.observe({ type: 'long-animation-frame' })
  return observer
}

/** "Primeira tela usável" = a lista de servidores chegou. Só lê o store. */
function whenServersLoaded(onLoaded: () => void): () => void {
  if (useServerStore.getState().serversLoaded) {
    onLoaded()
    return () => {}
  }
  const unsubscribe = useServerStore.subscribe((state) => {
    if (!state.serversLoaded) return
    unsubscribe()
    onLoaded()
  })
  return unsubscribe
}

function buildReport(stats: FrameStats, loafSupported: boolean): PerfReport {
  const { fps, loaf } = stats.take(performance.now())
  return {
    kind: 'report',
    ctx: buildPerfContext(router.state.location.pathname, useCallStore.getState()),
    fps: document.hidden ? null : fps,
    loaf: loafSupported ? loaf : null
  }
}

/** Observa quadros, LoAF e o estado do app e manda um relatório por segundo. */
export function startPerfReporting(send: (event: PerfEvent) => void): () => void {
  const stats = new FrameStats(performance.now())
  let frame = requestAnimationFrame(function tick() {
    stats.frame()
    frame = requestAnimationFrame(tick)
  })
  const observer = observeLongFrames((ms) => stats.longFrame(ms))
  const stopMark = whenServersLoaded(() => send({ kind: 'mark', name: 'usable' }))
  const timer = setInterval(() => send(buildReport(stats, observer !== null)), REPORT_MS)
  return () => {
    cancelAnimationFrame(frame)
    clearInterval(timer)
    observer?.disconnect()
    stopMark()
  }
}
```

- [ ] **Passo 5: implementar `PerfBridge.tsx`**

```tsx
import { useEffect } from 'react'
import { startPerfReporting } from './perfReporting'

/**
 * Medição de performance (`--perf-log`). Montado sempre no Electron, mas só age se o
 * main responder `true` em perf:enabled: sem a flag nada é observado nem enviado.
 */
function PerfBridge(): null {
  useEffect(() => {
    const perf = window.api?.perf
    if (!perf) return
    let cancelled = false
    let stop = (): void => {}
    void perf.enabled().then((enabled) => {
      if (enabled && !cancelled) stop = startPerfReporting(perf.report)
    })
    return () => {
      cancelled = true
      stop()
    }
  }, [])
  return null
}

export default PerfBridge
```

- [ ] **Passo 6: montar no `App.tsx` (sem condicional)**

Em `frontend/src/renderer/src/app/App.tsx`, junto de `import BackgroundBridge from './BackgroundBridge'` acrescente `import PerfBridge from './PerfBridge'` e, no ramo do Electron, logo depois de `<BackgroundBridge />`, acrescente `<PerfBridge />`. **Não** envolva em `&&`/ternário: o `App` está com CRAP 12 e uma condicional o levaria a 20.

- [ ] **Passo 7: testes, typecheck e lint**

Run: `cd frontend && npx vitest run src/renderer/src/app/perfContext.test.ts && npm run typecheck && npx eslint src/renderer/src/app/perfContext.ts src/renderer/src/app/perfReporting.ts src/renderer/src/app/PerfBridge.tsx src/renderer/src/shared/lib/perf src/main/perf src/shared/perfLog.ts`
Expected: testes passam; typecheck sem erros; só importam erros (`severity 2`).

- [ ] **Passo 8: commit**

```bash
git add frontend/src/renderer/src/app/perfContext.ts frontend/src/renderer/src/app/perfContext.test.ts frontend/src/renderer/src/app/perfReporting.ts frontend/src/renderer/src/app/PerfBridge.tsx frontend/src/renderer/src/app/App.tsx
git commit -m "feat(perf): renderer observa FPS, LoAF e contexto e reporta ao main"
```

---

### Tarefa 11: relatório (`scripts/lib/perfReport.mjs` + CLI)

**Arquivos:**
- Criar: `scripts/lib/perfReport.mjs`, `scripts/lib/perfReport.test.mjs`, `scripts/perf-report.mjs`

**Interfaces:**
- Produz (`perfReport.mjs`): `parseJsonl(text) → { lines, corrupt }`, `percentile(values, p)`, `mean(values)`, `contextKey(ctx)`, `groupSamples(samples, discardSec = 10) → Map<string, sample[]>`, `summarizeGroup(samples)`, `summarize(text) → { startup, groups, corrupt, ended }`, `delta(before, after)`, `formatReport(a, b = null) → string`. `MIN_SAMPLES = 30`.
- Chave de contexto: `window` + `" + chamada"`/`" + transmitindo"`/`" + assistindo"` (ex.: `visible + chamada + transmitindo`).

- [ ] **Passo 1: escrever o teste que falha**

`scripts/lib/perfReport.test.mjs`:
```js
import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  contextKey,
  delta,
  formatReport,
  groupSamples,
  mean,
  parseJsonl,
  percentile,
  summarize,
  summarizeGroup
} from './perfReport.mjs'

const ctx = (window = 'visible', extra = {}) => ({
  window,
  route: '/',
  inCall: false,
  sharing: false,
  watching: false,
  ...extra
})

function sample(t, window = 'visible', cpu = 2, extra = {}) {
  return {
    t,
    kind: 'sample',
    ctx: ctx(window),
    procs: { Tab: { cpu, memMB: 100 }, GPU: { cpu: 1, memMB: 50 } },
    fps: 60,
    loaf: { count: 0, maxMs: 0, totalMs: 0 },
    ...extra
  }
}

const range = (from, to) => Array.from({ length: to - from }, (_, i) => from + i)
const jsonl = (lines) => lines.map((l) => JSON.stringify(l)).join('\n')

test('parseJsonl: ignora linha vazia e conta a corrompida', () => {
  const { lines, corrupt } = parseJsonl('{"a":1}\n\nnão é json\n{"b":2}\n')
  assert.deepEqual(lines, [{ a: 1 }, { b: 2 }])
  assert.equal(corrupt, 1)
})

test('percentile e mean', () => {
  assert.equal(percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 95), 10)
  assert.equal(percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 5), 1)
  assert.equal(percentile([], 95), null)
  assert.equal(mean([2, 4]), 3)
  assert.equal(mean([]), null)
})

test('contextKey: janela mais as marcas de chamada', () => {
  assert.equal(contextKey(ctx('tray')), 'tray')
  assert.equal(
    contextKey(ctx('visible', { inCall: true, sharing: true, watching: true })),
    'visible + chamada + transmitindo + assistindo'
  )
})

test('groupSamples: descarta 10 s depois de cada troca de contexto', () => {
  const samples = [
    ...range(0, 30).map((t) => sample(t, 'visible')),
    ...range(30, 50).map((t) => sample(t, 'tray'))
  ]
  const groups = groupSamples(samples)
  assert.deepEqual(groups.get('visible').map((s) => s.t), range(10, 30))
  assert.deepEqual(groups.get('tray').map((s) => s.t), range(40, 50))
})

test('summarizeGroup: média, p95 e RAM somam todos os processos; cpu null é ignorada', () => {
  const first = sample(0, 'visible', 0, { procs: { Tab: { cpu: null, memMB: 100 } } })
  const rest = range(1, 30).map((t) => sample(t, 'visible', 2))
  const summary = summarizeGroup([first, ...rest])
  assert.equal(summary.cpuMean, 3)
  assert.equal(summary.cpuP95, 3)
  assert.equal(summary.memMean, (100 + 29 * 150) / 30)
  assert.deepEqual(summary.procs.Tab, { cpuMean: 2, memMean: 100 })
  assert.equal(summary.fpsP5, 60)
})

test('summarizeGroup: amostra pequena abaixo de 30', () => {
  assert.equal(summarizeGroup(range(0, 29).map((t) => sample(t))).small, true)
  assert.equal(summarizeGroup(range(0, 30).map((t) => sample(t))).small, false)
})

test('summarizeGroup: LoAF por minuto e máximo; fps e loaf null não entram', () => {
  const withLoaf = range(0, 30).map((t) =>
    sample(t, 'visible', 2, { loaf: { count: t % 2, maxMs: t, totalMs: t } })
  )
  const none = sample(30, 'visible', 2, { fps: null, loaf: null })
  const summary = summarizeGroup([...withLoaf, none])
  assert.equal(summary.loafMaxMs, 29)
  assert.equal(summary.loafPerMin, (15 / 30) * 60)
  assert.equal(summary.fpsP5, 60)
})

test('summarize: arquivo sem end (crash) e linha corrompida', () => {
  const text = [
    jsonl([{ kind: 'startup', appReadyMs: 300, readyToShowMs: 1200, usableMs: 2000 }]),
    'lixo',
    jsonl(range(0, 50).map((t) => sample(t)))
  ].join('\n')
  const result = summarize(text)
  assert.equal(result.ended, false)
  assert.equal(result.corrupt, 1)
  assert.equal(result.startup.usableMs, 2000)
  assert.equal(result.groups.visible.n, 40)
})

test('summarize: end marca o arquivo como completo', () => {
  assert.equal(summarize(jsonl([sample(0), { kind: 'end', t: 1 }])).ended, true)
})

test('delta', () => {
  assert.equal(delta(4, 2), '-50%')
  assert.equal(delta(2, 3), '+50%')
  assert.equal(delta(0, 3), '')
  assert.equal(delta(null, 3), '')
  assert.equal(delta(3, undefined), '')
})

test('formatReport: um arquivo mostra contexto, métricas e aviso de amostra pequena', () => {
  const text = jsonl([
    { kind: 'startup', appReadyMs: 300, readyToShowMs: 1200, usableMs: 2000 },
    ...range(0, 20).map((t) => sample(t))
  ])
  const out = formatReport(summarize(text))
  assert.match(out, /Contexto: visible/)
  assert.match(out, /\(amostra pequena\)/)
  assert.match(out, /CPU total % \(média\)\s+3\.0/)
  assert.match(out, /usável \(ms\)\s+2000\.0/)
})

test('formatReport: dois arquivos mostram antes → depois e a diferença', () => {
  const build = (cpu) => summarize(jsonl(range(0, 50).map((t) => sample(t, 'visible', cpu))))
  const out = formatReport(build(4), build(1))
  assert.match(out, /CPU total % \(média\)\s+5\.0\s+→\s+2\.0\s+-60%/)
})

test('formatReport: contexto só de um lado aparece com traço no outro', () => {
  const only = summarize(jsonl(range(0, 50).map((t) => sample(t, 'tray'))))
  const other = summarize(jsonl(range(0, 50).map((t) => sample(t, 'visible'))))
  const out = formatReport(only, other)
  assert.match(out, /Contexto: tray/)
  assert.match(out, /Contexto: visible/)
  assert.match(out, /—/)
})
```

- [ ] **Passo 2: rodar e ver falhar**

Run: `node --test scripts/lib/perfReport.test.mjs`
Expected: FAIL (`Cannot find module './perfReport.mjs'`).

- [ ] **Passo 3: implementar `scripts/lib/perfReport.mjs`**

```js
// Resume e compara os arquivos perf-*.jsonl gravados com --perf-log.

export const MIN_SAMPLES = 30
const DISCARD_SEC = 10

export function parseJsonl(text) {
  const lines = []
  let corrupt = 0
  for (const raw of text.split('\n')) {
    if (!raw.trim()) continue
    try {
      lines.push(JSON.parse(raw))
    } catch {
      corrupt += 1
    }
  }
  return { lines, corrupt }
}

export function percentile(values, p) {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  return sorted[Math.max(0, Math.ceil((p / 100) * sorted.length) - 1)]
}

export function mean(values) {
  return values.length === 0 ? null : values.reduce((sum, v) => sum + v, 0) / values.length
}

export function contextKey(ctx) {
  const tags = [ctx.inCall && 'chamada', ctx.sharing && 'transmitindo', ctx.watching && 'assistindo']
  return [ctx.window, ...tags.filter(Boolean)].join(' + ')
}

/** Agrupa por contexto e descarta os primeiros `discardSec` s depois de cada troca. */
export function groupSamples(samples, discardSec = DISCARD_SEC) {
  const groups = new Map()
  let current = null
  let since = 0
  for (const s of samples) {
    const key = contextKey(s.ctx)
    if (key !== current) {
      current = key
      since = s.t
    }
    if (s.t - since < discardSec) continue
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key).push(s)
  }
  return groups
}

const total = (procs, field) => Object.values(procs).reduce((sum, p) => sum + (p[field] ?? 0), 0)
const hasCpu = (s) => Object.values(s.procs).some((p) => p.cpu !== null)
const present = (v) => v !== null && v !== undefined

function summarizeProcs(samples) {
  const names = new Set(samples.flatMap((s) => Object.keys(s.procs)))
  return Object.fromEntries(
    [...names].sort().map((name) => {
      const own = samples.map((s) => s.procs[name]).filter(Boolean)
      return [
        name,
        { cpuMean: mean(own.map((p) => p.cpu).filter(present)), memMean: mean(own.map((p) => p.memMB)) }
      ]
    })
  )
}

function summarizeLoaf(samples) {
  const loafed = samples.filter((s) => s.loaf)
  if (loafed.length === 0) return { loafPerMin: null, loafMaxMs: null }
  const count = loafed.reduce((sum, s) => sum + s.loaf.count, 0)
  return {
    loafPerMin: (count / loafed.length) * 60,
    loafMaxMs: Math.max(...loafed.map((s) => s.loaf.maxMs))
  }
}

export function summarizeGroup(samples) {
  const cpu = samples.filter(hasCpu).map((s) => total(s.procs, 'cpu'))
  return {
    n: samples.length,
    small: samples.length < MIN_SAMPLES,
    cpuMean: mean(cpu),
    cpuP95: percentile(cpu, 95),
    memMean: mean(samples.map((s) => total(s.procs, 'memMB'))),
    fpsP5: percentile(samples.map((s) => s.fps).filter(present), 5),
    ...summarizeLoaf(samples),
    procs: summarizeProcs(samples)
  }
}

export function summarize(text) {
  const { lines, corrupt } = parseJsonl(text)
  const samples = lines.filter((l) => l.kind === 'sample')
  const groups = {}
  for (const [key, group] of groupSamples(samples)) groups[key] = summarizeGroup(group)
  return {
    startup: lines.find((l) => l.kind === 'startup') ?? null,
    groups,
    corrupt,
    ended: lines.some((l) => l.kind === 'end')
  }
}

export function delta(before, after) {
  if (!present(before) || !present(after) || before === 0) return ''
  const pct = Math.round(((after - before) / before) * 100)
  return `${pct > 0 ? '+' : ''}${pct}%`
}

const fmt = (v) => (present(v) ? v.toFixed(1) : '—')

function row(label, before, after, compare) {
  const base = `  ${label.padEnd(26)}${fmt(before)}`
  return compare ? `${base}  →  ${fmt(after)}  ${delta(before, after)}`.trimEnd() : base
}

function startupRows(a, b) {
  const fields = [
    ['app pronto (ms)', 'appReadyMs'],
    ['janela pronta (ms)', 'readyToShowMs'],
    ['usável (ms)', 'usableMs']
  ]
  return fields.map(([label, f]) => row(label, a.startup?.[f], b?.startup?.[f], b !== null))
}

function procRows(x, y, compare) {
  const names = new Set([...Object.keys(x?.procs ?? {}), ...Object.keys(y?.procs ?? {})])
  return [...names].sort().flatMap((name) => [
    row(`${name} CPU %`, x?.procs[name]?.cpuMean, y?.procs[name]?.cpuMean, compare),
    row(`${name} RAM MB`, x?.procs[name]?.memMean, y?.procs[name]?.memMean, compare)
  ])
}

function groupRows(key, x, y, compare) {
  const counts = compare ? `${x?.n ?? 0} / ${y?.n ?? 0}` : `${x?.n ?? 0}`
  const small = x?.small || y?.small ? '  (amostra pequena)' : ''
  return [
    `Contexto: ${key}  (n=${counts})${small}`,
    row('CPU total % (média)', x?.cpuMean, y?.cpuMean, compare),
    row('CPU total % (p95)', x?.cpuP95, y?.cpuP95, compare),
    row('RAM total MB (média)', x?.memMean, y?.memMean, compare),
    row('FPS (p5)', x?.fpsP5, y?.fpsP5, compare),
    row('LoAF por minuto', x?.loafPerMin, y?.loafPerMin, compare),
    row('LoAF máx (ms)', x?.loafMaxMs, y?.loafMaxMs, compare),
    ...procRows(x, y, compare)
  ]
}

/** Texto do relatório; com `b` mostra "antes → depois" e a diferença em %. */
export function formatReport(a, b = null) {
  const compare = b !== null
  const out = []
  const bad = a.corrupt + (b?.corrupt ?? 0)
  if (bad > 0) out.push(`Aviso: ${bad} linha(s) corrompida(s) ignorada(s).`)
  if (!a.ended || (b && !b.ended)) out.push('Aviso: arquivo sem linha "end" (o app fechou de forma abrupta).')
  out.push('Abertura', ...startupRows(a, b), '')
  const keys = new Set([...Object.keys(a.groups), ...Object.keys(b?.groups ?? {})])
  for (const key of keys) out.push(...groupRows(key, a.groups[key], b?.groups[key], compare), '')
  return out.join('\n')
}
```

- [ ] **Passo 4: rodar e ver passar**

Run: `node --test scripts/lib/perfReport.test.mjs`
Expected: PASS (todos). Se um teste de formatação falhar por espaçamento, ajuste a **regex do teste** só se o texto estiver legível e correto; não force o código a casar com a regex.

- [ ] **Passo 5: CLI `scripts/perf-report.mjs`**

```js
#!/usr/bin/env node
// Resume (ou compara) arquivos de medição gravados com --perf-log.
//   node scripts/perf-report.mjs <perf.jsonl>
//   node scripts/perf-report.mjs <antes.jsonl> <depois.jsonl>
import { readFileSync } from 'node:fs'
import { formatReport, summarize } from './lib/perfReport.mjs'

const [first, second] = process.argv.slice(2)
if (!first) {
  console.error('uso: node scripts/perf-report.mjs <antes.jsonl> [depois.jsonl]')
  process.exit(2)
}

const load = (path) => summarize(readFileSync(path, 'utf8'))
console.log(formatReport(load(first), second ? load(second) : null))
```

- [ ] **Passo 6: rodar o CLI contra um arquivo sintético**

Run (bash, da raiz):
```bash
node -e "const l=[{kind:'startup',appReadyMs:300,readyToShowMs:1200,usableMs:2000}];for(let t=0;t<50;t++)l.push({t,kind:'sample',ctx:{window:'visible',route:'/',inCall:false,sharing:false,watching:false},procs:{Tab:{cpu:2,memMB:100}},fps:60,loaf:{count:0,maxMs:0,totalMs:0}});l.push({kind:'end',t:50});console.log(l.map(x=>JSON.stringify(x)).join('\n'))" > "$TMPDIR/perf-demo.jsonl" && node scripts/perf-report.mjs "$TMPDIR/perf-demo.jsonl" "$TMPDIR/perf-demo.jsonl"
```
Expected: tabela com `Contexto: visible`, `usável (ms) 2000.0 → 2000.0 +0%`... e todas as diferenças em `+0%` (mesmo arquivo duas vezes). Se `$TMPDIR` não existir no shell, use o scratchpad da sessão.

- [ ] **Passo 7: commit**

```bash
git add scripts/lib/perfReport.mjs scripts/lib/perfReport.test.mjs scripts/perf-report.mjs
git commit -m "feat(perf): script de relatório e comparação das medições"
```

---

### Tarefa 12: documentação, spec e verificação de ponta a ponta

**Arquivos:**
- Criar: `docs/PERFORMANCE.md`
- Modificar: `docs/ai/arquitetura.md` (lista de pastas do `main/`), `docs/superpowers/specs/2026-10-26-perf-medicao-base-design.md` (ajustes abaixo)

- [ ] **Passo 1: `docs/PERFORMANCE.md`**

Conteúdo (português, para devs):
- **O que é:** medição só para dev, ligada por `--perf-log` ou `SALINHA_PERF_LOG=1`; sem a flag nada roda.
- **Como medir (Windows, app empacotado):** `yarn build:unpack`; feche o Salinha instalado (o app trava numa instância só); abra `frontend\dist\win-unpacked\Salinha.exe --perf-log`; o arquivo vai para `%APPDATA%\Concord\perf\perf-AAAAMMDD-HHmmss.jsonl`.
- **Roteiro dos cenários** (anotar a ordem; o relatório agrupa sozinho pelo contexto): 2 min parado com a janela visível; 2 min com a janela fechada na bandeja; 1 min rolando um canal grande; 2 min em chamada de voz; opcional: 2 min transmitindo e 2 min assistindo tela. Esperar os 10 s iniciais de cada troca (são descartados).
- **Ler o relatório:** `node scripts/perf-report.mjs perf.jsonl` e `node scripts/perf-report.mjs antes.jsonl depois.jsonl`; o que cada linha significa (CPU em % da máquina; RAM em MB; FPS p5; LoAF por minuto = quadros > 50 ms); "amostra pequena" = menos de 30 amostras.
- **Regras para comparar:** mesma máquina, mesmo cenário, app recém-aberto, nada pesado em segundo plano; repetir 2 vezes se a diferença for pequena.
- **Investigar um número ruim:** `Salinha.exe --trace-startup --trace-startup-file=%TEMP%\trace.json` (abertura) e a aba Performance do DevTools; abrir o trace em `chrome://tracing` ou `ui.perfetto.dev`. Isso é investigação; a linha de base é sempre o `--perf-log`.
- **Privacidade:** a rota é gravada com os IDs trocados por `:id`; o arquivo não tem mensagens nem nomes.

- [ ] **Passo 2: `docs/ai/arquitetura.md`**

Na árvore do frontend, linha `activity/ app/ overlay/ screen/ updates/ window/`, acrescente `perf/`.

- [ ] **Passo 3: corrigir a spec** (o que a implementação decidiu diferente do desenho aprovado)

Em `docs/superpowers/specs/2026-10-26-perf-medicao-base-design.md`:
1. **Arquitetura:** acrescentar `main/perf/windowState.ts` e `main/perf/perfSession.ts` (a sessão junta relatório e amostra; o `setupPerfLog` fica só com a ligação) e `app/perfContext.ts` + `app/perfReporting.ts` (o `PerfBridge` fica fino); `startupMarks.ts` é uma classe `StartupMarks`.
2. **Flag:** o argv do app **não chega ao renderer** (o Chromium não repassa switches desconhecidos), então o preload não lê a flag: o renderer pergunta ao main por IPC (`perf:enabled`), e `window.api.perf = { enabled(), report(evento) }`.
3. **Contexto:** `inCall` é `callStore.status === 'active'` (não `callId !== null`).
4. **Marco `usable`:** vem da inscrição (só leitura) em `serverStore.serversLoaded`, dentro do `perfReporting`; nenhum componente é alterado.
5. **`procs[*].cpu`** pode ser `null` na primeira amostra; `appReady` é medido quando o `setupPerfLog` roda, e ele é a primeira chamada do `whenReady`.
6. **`startup`:** é gravada quando os 3 marcos chegam ou aos 60 s, com `null` no que faltou.

- [ ] **Passo 4: verificação do pipeline**

Run (raiz): `node scripts/affected-tests.mjs pr`
Expected: tudo verde (testes afetados, typecheck, estrutura, CRAP ≤ 15 nas funções tocadas). Guarde a saída para o PR. Se o CRAP reprovar uma função **nova**, quebre a função ou cubra com teste; se reprovar uma função antiga de `main/index.ts` que **não foi tocada**, confira se o diff não a alterou.

- [ ] **Passo 5: verificação de ponta a ponta (com o usuário)**

Isso exige o app empacotado e uma máquina Windows com sessão do usuário; **combine com o usuário** antes de abrir o app dele.
1. `cd frontend && yarn build:unpack` (precisa do `postcss.config.mjs` temporário; ver Passo 6).
2. Abrir `Salinha.exe --perf-log` e seguir o roteiro do `docs/PERFORMANCE.md`. Se o Salinha instalado estiver aberto, a instância nova sai pelo lock de instância única: peça para fechar o instalado, ou use o `main.cjs` de scratch que troca o `userData` (ver a nota do ambiente).
3. Conferir que `perf-*.jsonl` tem `startup`, amostras nos 4 contextos e `end`.
4. `node scripts/perf-report.mjs <arquivo>` mostra os 4 contextos; com o mesmo arquivo duas vezes, todos `+0%`/vazios.
5. Abrir **sem** a flag e conferir que nenhum arquivo novo aparece em `%APPDATA%\Concord\perf\`.
6. Anexar o relatório da linha de base ao PR.

- [ ] **Passo 6: limpar o contorno do ambiente**

Run: `rm -f frontend/postcss.config.mjs && git status --short`
Expected: `frontend/postcss.config.mjs` não aparece mais; nenhum arquivo inesperado.

- [ ] **Passo 7: commit da documentação**

```bash
git add docs/PERFORMANCE.md docs/ai/arquitetura.md docs/superpowers/specs/2026-10-26-perf-medicao-base-design.md
git commit -m "docs(perf): roteiro de medição e ajustes da spec"
```

---

## Autorrevisão

**Cobertura da spec:** flag (T2, T7) · amostra por tipo de processo (T3) · contexto com `window/route/inCall/sharing/watching` (T2, T6, T10) · FPS e LoAF (T9, T10) · abertura (T4, T6, T7, T10) · rota normalizada (T1) · JSONL + `end` + tolerância a falha (T5, T7) · relatório com descarte de 10 s, p95, "amostra pequena", Δ%, arquivo sem `end`, linha corrompida (T11) · roteiro + trace (T12) · sem a flag nada roda (T7 testa, T10 gate no `PerfBridge`) · verificação de ponta a ponta (T12).

**Tipos:** `ProcStats`/`SampleLine`/`StartupLine`/`PerfEvent` definidos na T1 e usados com os mesmos nomes em T3–T7, T10. `StartupMark` (T4) usado em T6. `FrameStats.take → { fps, loaf }` (T9) usado em T10. `perf.enabled()`/`perf.report()` (T8) usados em T10. Canais `perf:enabled`/`perf:report` iguais em T7 e T8.

**Riscos conhecidos:** `windowState` depende de `isVisible()` devolver `false` com a janela oculta na bandeja (confirmar no ponta a ponta); o `appReady` é o instante em que `setupPerfLog` roda (início do `whenReady`), não o evento `ready` do Electron.
