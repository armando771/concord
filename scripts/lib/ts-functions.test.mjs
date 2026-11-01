import assert from 'node:assert/strict'
import { test } from 'node:test'
import { coverageOf, parseSource } from './ts-functions.mjs'

const source = `export function plain() {
  return 1
}

export const branchy = (xs: number[], ok?: boolean) => {
  let total = 0
  for (const x of xs) {
    if (x > 0 && ok) total += x
  }
  const inner = () => (total > 10 ? 'big' : 'small')
  return total ?? inner()
}

class Box {
  get size() { return 0 }
}
`

test('parseSource: nome, intervalo e complexidade sem contar funções aninhadas', () => {
  const fns = parseSource('a.ts', source)
  const byName = Object.fromEntries(fns.map((f) => [f.name, f]))
  assert.deepEqual(Object.keys(byName), ['plain', 'branchy', 'inner', 'size'])
  assert.equal(byName.plain.complexity, 1)
  // 1 + for-of + if + && + ?? (o ?: está dentro de `inner`)
  assert.equal(byName.branchy.complexity, 5)
  assert.equal(byName.branchy.start, 5)
  assert.equal(byName.branchy.end, 12)
  assert.equal(byName.inner.complexity, 2)
})

test('coverageOf: statements do istanbul dentro do intervalo da função', () => {
  const fileCoverage = {
    statementMap: { 0: { start: { line: 6 } }, 1: { start: { line: 7 } }, 2: { start: { line: 8 } }, 3: { start: { line: 30 } } },
    s: { 0: 1, 1: 1, 2: 0, 3: 0 }
  }
  const fn = { start: 5, end: 12 }
  assert.equal(coverageOf(fn, fileCoverage), 2 / 3)
  assert.equal(coverageOf(fn, undefined), 0)
})
