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
