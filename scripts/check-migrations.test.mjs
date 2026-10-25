import assert from 'node:assert/strict'
import { test } from 'node:test'
import { checkMigrations } from './check-migrations.mjs'

const files = (...names) => names.flatMap((n) => [`${n}.up.sql`, `${n}.down.sql`])

test('tudo certo: números únicos e a nova acima da maior do destino', () => {
  const base = files('000019_soundboard', '000020_user_profile')
  const head = [...base, ...files('000023_call_state')]
  assert.deepEqual(checkMigrations(head, base), [])
})

test('reprova número repetido', () => {
  const head = files('000019_soundboard', '000019_login')
  const errors = checkMigrations(head)
  assert.equal(errors.length, 1)
  assert.match(errors[0], /000019/)
  assert.match(errors[0], /000019_soundboard\.up\.sql/)
  assert.match(errors[0], /000019_login\.up\.sql/)
})

test('reprova migration nova com número abaixo da maior do destino', () => {
  // O destino já tem a 000023; uma 000021 nova nunca rodaria num banco que
  // já está na 23.
  const base = files('000020_user_profile', '000023_call_state')
  const head = [...base, ...files('000021_login')]
  const errors = checkMigrations(head, base)
  assert.equal(errors.length, 1)
  assert.match(errors[0], /000021_login\.up\.sql/)
  assert.match(errors[0], /000023/)
})

test('reprova migration nova com o mesmo número da maior do destino', () => {
  const base = files('000023_call_state')
  const head = [...base, ...files('000023_outra')]
  const errors = checkMigrations(head, base)
  assert.ok(errors.some((e) => /mesmo número/.test(e)))
  assert.ok(errors.some((e) => /000023_outra\.up\.sql/.test(e)))
})

test('sem destino (push na main): só confere repetidos', () => {
  assert.deepEqual(checkMigrations(files('000001_a', '000002_b')), [])
})

test('ignora arquivos que não são migration', () => {
  assert.deepEqual(checkMigrations(['README.md', ...files('000001_a')]), [])
})

test('nome sem número é erro', () => {
  const errors = checkMigrations(['add_coisa.up.sql'])
  assert.equal(errors.length, 1)
  assert.match(errors[0], /add_coisa\.up\.sql/)
})
