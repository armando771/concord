import assert from 'node:assert/strict'
import { test } from 'node:test'
import { crap, evaluate, formatReport, touches } from './crap.mjs'
import { parseDiff } from './diff.mjs'

test('CRAP: sem teste é complexidade² + complexidade; 100% coberto é só a complexidade', () => {
  assert.equal(crap(5, 0), 30)
  assert.equal(crap(5, 1), 5)
  assert.equal(crap(1, 0), 2)
})

test('touches: faixa alterada cruzando o intervalo da função', () => {
  const fn = { start: 10, end: 20 }
  assert.ok(touches(fn, [[20, 25]]))
  assert.ok(touches(fn, [[1, 10]]))
  assert.ok(!touches(fn, [[21, 30]]))
  assert.ok(!touches(fn, []))
})

test('evaluate: só função tocada acima do limite falha; o resto do arquivo vira aviso', () => {
  const fns = [
    { file: 'a.go', name: 'Tocada', start: 1, end: 10, complexity: 10, coverage: 0 },
    { file: 'a.go', name: 'Antiga', start: 20, end: 30, complexity: 10, coverage: 0 },
    { file: 'a.go', name: 'Simples', start: 40, end: 42, complexity: 2, coverage: 0 }
  ]
  const result = evaluate(fns, { 'a.go': [[5, 5]] })
  assert.deepEqual(result.failures.map((f) => f.name), ['Tocada'])
  assert.deepEqual(result.warnings.map((f) => f.name), ['Antiga'])
  assert.equal(evaluate(fns, {}, { wholeFile: true }).failures.length, 2)
})

test('formatReport: tabela das funções tocadas, marcando as acima do limite', () => {
  const fns = [
    { file: 'a.ts', name: 'ok', start: 3, end: 9, complexity: 6, coverage: 0.5 },
    { file: 'a.ts', name: 'ruim', start: 10, end: 20, complexity: 10, coverage: 0.5 }
  ]
  const report = formatReport(evaluate(fns, { 'a.ts': [[3, 3]] }))
  assert.match(report, /\| a\.ts:3 \| ok \| 6 \| 50% \| 10\.5 \|/)
  assert.match(report, /não tocada.*\n.*\n.*\n\| a\.ts:10 \| ruim \| 10 \| 50% \| ❌ 22\.5 \|/)
  assert.match(report, /✅ Nenhuma função tocada acima do limite/)
  assert.match(formatReport(evaluate(fns, {}, { wholeFile: true })), /❌ 1 função\(ões\) tocada\(s\) acima do limite/)
})

test('parseDiff: linhas novas por arquivo, ignorando remoções puras e arquivos apagados', () => {
  const diff = [
    'diff --git a/x.go b/x.go',
    '--- a/x.go',
    '+++ b/x.go',
    '@@ -3 +3 @@ func a() {',
    '@@ -10,2 +11,4 @@',
    '@@ -20,3 +23,0 @@',
    'diff --git a/old.ts b/old.ts',
    '--- a/old.ts',
    '+++ /dev/null',
    '@@ -1,5 +0,0 @@'
  ].join('\n')
  assert.deepEqual(parseDiff(diff), { 'x.go': [[3, 3], [11, 14]] })
})
