import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  cpuSample,
  formatComparison,
  formatTable,
  median,
  medianOfRuns,
  summarizeRun
} from './perfBench.mjs'

const reading = (type, pid, cpu, memKB = 1024) => ({
  type,
  pid,
  creationTime: 1,
  cpu,
  memKB
})

test('cpuSample: % de um núcleo por tipo de processo, pelo delta da CPU cumulativa', () => {
  const before = [reading('Browser', 1, 10), reading('GPU', 2, 5), reading('Tab', 3, 1), reading('Tab', 4, 0)]
  const after = [reading('Browser', 1, 10.5), reading('GPU', 2, 5.25), reading('Tab', 3, 1.5), reading('Tab', 4, 0.5)]
  const s = cpuSample(before, after, 1)
  assert.equal(s.cpu.Browser, 50)
  assert.equal(s.cpu.GPU, 25)
  assert.equal(s.cpu.Tab, 100)
  assert.equal(s.cpu.total, 175)
  assert.equal(s.memMB, 4)
})

test('cpuSample: processo novo (sem leitura anterior) não conta CPU, só memória', () => {
  const s = cpuSample([], [reading('Utility', 9, 3)], 1)
  assert.equal(s.cpu.Utility, 0)
  assert.equal(s.cpu.total, 0)
  assert.equal(s.memMB, 1)
})

test('cpuSample: tipos desconhecidos caem em Other e o intervalo divide o delta', () => {
  const s = cpuSample([reading('Zygote', 5, 1)], [reading('Zygote', 5, 2)], 2)
  assert.equal(s.cpu.Other, 50)
})

test('median: ímpar, par e vazio', () => {
  assert.equal(median([3, 1, 2]), 2)
  assert.equal(median([4, 1, 2, 3]), 2.5)
  assert.equal(median([]), null)
})

const sample = (total, gpuBusy = 10) => ({
  cpu: { Browser: 1, GPU: 2, Tab: total - 3, Utility: 0, Other: 0, total },
  gpuBusy,
  memMB: 300
})

test('summarizeRun: média e p95 de cada métrica', () => {
  const samples = Array.from({ length: 20 }, (_, i) => sample(i + 3, i))
  const run = summarizeRun(samples)
  assert.equal(run.n, 20)
  assert.equal(run.total.mean, 12.5)
  assert.equal(run.total.p95, 21)
  assert.equal(run.gpuBusy.p95, 18)
  assert.equal(run.Browser.mean, 1)
  assert.equal(run.memMB.mean, 300)
})

test('summarizeRun: GPU busy indisponível vira null', () => {
  const run = summarizeRun([{ ...sample(5), gpuBusy: null }])
  assert.equal(run.gpuBusy, null)
})

test('medianOfRuns: mediana das médias e dos p95 entre repetições', () => {
  const runs = [10, 30, 20].map((v) => summarizeRun([sample(v)]))
  const m = medianOfRuns(runs)
  assert.equal(m.total.mean, 20)
  assert.equal(m.total.p95, 20)
  assert.equal(m.total.min, 10)
  assert.equal(m.total.max, 30)
  assert.equal(m.reps, 3)
})

test('formatTable: uma linha por cenário com CPU por tipo e GPU busy', () => {
  const results = { 'a-texto-foco': medianOfRuns([summarizeRun([sample(10)])]) }
  const md = formatTable(results)
  assert.match(md, /\| Cenário \|/)
  assert.match(md, /\| a-texto-foco \| 10\.0 \/ 10\.0 \|/)
  assert.match(md, /\| 10\.0–10\.0 \|$/)
})

test('formatComparison: antes → depois e Δ% da média', () => {
  const before = { b: medianOfRuns([summarizeRun([sample(20, 40)])]) }
  const after = { b: medianOfRuns([summarizeRun([sample(5, 10)])]) }
  const md = formatComparison(before, after)
  assert.match(md, /\| b \| CPU total \| 20\.0 \/ 20\.0 \| 5\.0 \/ 5\.0 \| -75% \|/)
  assert.match(md, /\| b \| GPU busy % \| 40\.0 \/ 40\.0 \| 10\.0 \/ 10\.0 \| -75% \|/)
})

test('formatComparison: cenário que só existe de um lado aparece com —', () => {
  const before = { x: medianOfRuns([summarizeRun([sample(20)])]) }
  const md = formatComparison(before, {})
  assert.match(md, /\| x \| CPU total \| 20\.0 \/ 20\.0 \| — \| — \|/)
})
