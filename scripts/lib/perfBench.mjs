// Contas do banco de medição (scripts/perf-bench.mjs): CPU por tipo de processo a
// partir de app.getAppMetrics(), resumo por cenário e tabelas antes/depois.
import { mean, percentile } from './perfReport.mjs'

export const PROC_TYPES = ['Browser', 'GPU', 'Tab', 'Utility', 'Other']
const METRICS = [...PROC_TYPES, 'total']

const typeOf = (type) => (PROC_TYPES.includes(type) ? type : 'Other')
const keyOf = (r) => `${r.pid}:${r.creationTime}`

/**
 * Uma amostra a partir de duas leituras de getAppMetrics (cpu = segundos de CPU
 * cumulativos). CPU em % de UM núcleo (100 = um núcleo inteiro), somada por tipo.
 */
export function cpuSample(before, after, elapsedSec) {
  const previous = new Map(before.map((r) => [keyOf(r), r.cpu]))
  const cpu = Object.fromEntries(METRICS.map((m) => [m, 0]))
  let memKB = 0
  for (const r of after) {
    memKB += r.memKB
    const last = previous.get(keyOf(r))
    if (last === undefined || r.cpu < last) continue
    const pct = ((r.cpu - last) / elapsedSec) * 100
    cpu[typeOf(r.type)] += pct
    cpu.total += pct
  }
  return { cpu, memMB: memKB / 1024 }
}

export function median(values) {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

const stat = (values) =>
  values.length === 0 ? null : { mean: mean(values), p95: percentile(values, 95) }

/** Média e p95 de cada métrica de uma repetição (amostras de 1 s). */
export function summarizeRun(samples) {
  const run = { n: samples.length }
  for (const m of METRICS) run[m] = stat(samples.map((s) => s.cpu[m]))
  run.gpuBusy = stat(samples.map((s) => s.gpuBusy).filter((v) => v !== null))
  run.memMB = stat(samples.map((s) => s.memMB))
  return run
}

/** Mediana entre repetições (da média e do p95, separadamente). */
export function medianOfRuns(runs) {
  const out = { reps: runs.length }
  for (const m of [...METRICS, 'gpuBusy', 'memMB']) {
    const stats = runs.map((r) => r[m]).filter(Boolean)
    out[m] =
      stats.length === 0
        ? null
        : {
            mean: median(stats.map((s) => s.mean)),
            p95: median(stats.map((s) => s.p95)),
            // Faixa das médias entre repetições: diz quanto o cenário oscila.
            min: Math.min(...stats.map((s) => s.mean)),
            max: Math.max(...stats.map((s) => s.mean))
          }
  }
  return out
}

const range = (s) => (s && s.min !== undefined ? `${s.min.toFixed(1)}–${s.max.toFixed(1)}` : '—')
const pair = (s) => (s ? `${s.mean.toFixed(1)} / ${s.p95.toFixed(1)}` : '—')

/** Tabela markdown: média / p95 por cenário. */
export function formatTable(results) {
  const cols = ['total', ...PROC_TYPES.filter((t) => t !== 'Other'), 'gpuBusy', 'memMB']
  const head = ['Cenário', 'CPU total', 'Browser', 'GPU', 'Tab', 'Utility', 'GPU busy %', 'RAM MB', 'CPU total: faixa das reps']
  const lines = [`| ${head.join(' | ')} |`, `|${head.map(() => '---').join('|')}|`]
  for (const [name, r] of Object.entries(results)) {
    lines.push(`| ${name} | ${cols.map((c) => pair(r[c])).join(' | ')} | ${range(r.total)} |`)
  }
  return lines.join('\n')
}

const ROWS = [
  ['total', 'CPU total'],
  ['GPU', 'CPU proc. GPU'],
  ['Tab', 'CPU renderer'],
  ['Browser', 'CPU main'],
  ['gpuBusy', 'GPU busy %']
]

function deltaPct(before, after) {
  if (!before || !after) return '—'
  if (before.mean === 0) return after.mean === 0 ? '0%' : '—'
  const pct = Math.round(((after.mean - before.mean) / before.mean) * 100)
  return `${pct > 0 ? '+' : ''}${pct}%`
}

/** Antes → depois por cenário e métrica (média / p95) com o Δ% da média. */
export function formatComparison(before, after) {
  const names = [...new Set([...Object.keys(before), ...Object.keys(after)])]
  const lines = ['| Cenário | Métrica | Antes (média / p95) | Depois (média / p95) | Δ média |', '|---|---|---|---|---|']
  for (const name of names) {
    for (const [key, label] of ROWS) {
      const b = before[name]?.[key] ?? null
      const a = after[name]?.[key] ?? null
      if (!b && !a) continue
      lines.push(`| ${name} | ${label} | ${pair(b)} | ${pair(a)} | ${deltaPct(b, a)} |`)
    }
  }
  return lines.join('\n')
}
