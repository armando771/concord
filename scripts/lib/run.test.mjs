import assert from 'node:assert/strict'
import { test } from 'node:test'
import { capture } from './run.mjs'

// Regressão: no Windows o argumento passa pelo cmd.exe, e o template do go list
// (aspas e |) chegava quebrado ("unexpected "," in operand").
test('capture entrega aspas e | intactos ao comando', () => {
  const arg = '{{.ImportPath}}|{{join .Imports ","}}|x y'
  assert.equal(capture('node', ['-e', 'process.stdout.write(process.argv[1])', arg]), arg)
})
