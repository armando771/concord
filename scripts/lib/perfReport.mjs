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
// CPU total só vale quando todos os processos da amostra têm CPU: um tipo que acabou de
// reaparecer vem com null, e somá-lo como 0 subestimaria a amostra.
const hasCpu = (s) => {
  const procs = Object.values(s.procs)
  return procs.length > 0 && procs.every((p) => p.cpu !== null)
}
const present = (v) => v !== null && v !== undefined

function summarizeProcs(samples) {
  const names = new Set(samples.flatMap((s) => Object.keys(s.procs)))
  return Object.fromEntries(
    [...names].sort().map((name) => {
      const own = samples.map((s) => s.procs[name]).filter(Boolean)
      return [
        name,
        {
          cpuMean: mean(own.map((p) => p.cpu).filter(present)),
          memMean: mean(own.map((p) => p.memMB))
        }
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
  const startup = lines.find((l) => l.kind === 'startup') ?? null
  // Antes da janela pronta o app ainda está abrindo (e a janela ainda não foi mostrada):
  // essas amostras são do boot, não de um contexto de uso.
  const bootEnd = (startup?.readyToShowMs ?? 0) / 1000
  const samples = lines.filter((l) => l.kind === 'sample' && l.t >= bootEnd)
  const groups = {}
  for (const [key, group] of groupSamples(samples)) groups[key] = summarizeGroup(group)
  return {
    startup,
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
  if (!a.ended || (b && !b.ended)) {
    out.push('Aviso: arquivo sem linha "end" (o app fechou de forma abrupta).')
  }
  out.push('Abertura', ...startupRows(a, b), '')
  const keys = new Set([...Object.keys(a.groups), ...Object.keys(b?.groups ?? {})])
  for (const key of keys) out.push(...groupRows(key, a.groups[key], b?.groups[key], compare), '')
  return out.join('\n')
}
