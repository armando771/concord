import assert from 'node:assert/strict'
import { test } from 'node:test'
import { classify, dependents, goPackages, parseGoList, scriptTests } from './affected.mjs'

test('classify separa Go, TS e scripts e detecta código compartilhado', () => {
  const result = classify(['backend/internal/call/service.go', 'frontend/src/renderer/src/features/chat/lib/x.ts', 'scripts/a.mjs', 'README.md'])
  assert.deepEqual(result.go, ['backend/internal/call/service.go'])
  assert.deepEqual(result.ts, ['frontend/src/renderer/src/features/chat/lib/x.ts'])
  assert.deepEqual(result.scripts, ['scripts/a.mjs'])
  assert.equal(result.shared, false)
  assert.equal(classify(['backend/internal/platform/database/db.go']).shared, true)
})

test('goPackages: diretórios únicos relativos a backend/', () => {
  assert.deepEqual(goPackages(['backend/internal/call/a.go', 'backend/internal/call/b_test.go', 'backend/cmd/main.go']), ['./cmd', './internal/call'])
})

test('dependents: fecho reverso, inclusive dependência de teste', () => {
  const graph = parseGoList(['m/a|', 'm/b|m/a|', 'm/c||m/b', 'm/d|m/x|'].join('\n'))
  assert.deepEqual(dependents(graph, ['m/a']), ['m/a', 'm/b', 'm/c'])
})

test('scriptTests: acha o .test.mjs vizinho e mantém testes alterados', () => {
  const exists = (f) => ['scripts/a.test.mjs', 'scripts/lib/b.test.mjs'].includes(f)
  assert.deepEqual(scriptTests(['scripts/a.mjs', 'scripts/sem-teste.mjs', 'scripts/lib/b.test.mjs'], exists), ['scripts/a.test.mjs', 'scripts/lib/b.test.mjs'])
})
