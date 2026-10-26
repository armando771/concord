import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { EMPTY_NOTES, MAX_ENTRIES, MAX_ENTRY_TEXT, parseNotes, publishError } from './publish-changelog.mjs'

test('separa novidades e correções, na ordem do arquivo', () => {
  const md = [
    '## Novidades',
    '- Changelog global',
    '* Outra novidade',
    '',
    '## Correções',
    '- Corrigido o som'
  ].join('\n')
  assert.deepEqual(parseNotes(md).entries, [
    { kind: 'feature', text: 'Changelog global' },
    { kind: 'feature', text: 'Outra novidade' },
    { kind: 'fix', text: 'Corrigido o som' }
  ])
})

test('arquivo vazio ou só com os títulos não tem entradas', () => {
  assert.deepEqual(parseNotes('').entries, [])
  assert.deepEqual(parseNotes(EMPTY_NOTES).entries, [])
})

test('bullet fora de uma seção é erro (evita publicar como o tipo errado)', () => {
  assert.throws(() => parseNotes('- solto'), /seção/)
})

test('seção desconhecida é erro', () => {
  assert.throws(() => parseNotes('## Outros\n- x'), /Outros/)
})

// Regressão da 0.6.43: a nota passou do limite do servidor e só o deploy viu.
test('nota acima do limite do servidor é erro antes do deploy', () => {
  const longa = 'é'.repeat(MAX_ENTRY_TEXT + 1)
  assert.throws(() => parseNotes(`## Novidades\n- ${longa}`), /1001 caracteres/)
})

test('o limite conta caracteres, não bytes', () => {
  const acentuada = 'ã'.repeat(MAX_ENTRY_TEXT)
  assert.equal(parseNotes(`## Correções\n- ${acentuada}`).entries[0].text, acentuada)
})

test('mais entradas que o servidor aceita é erro', () => {
  const bullets = Array.from({ length: MAX_ENTRIES + 1 }, (_, i) => `- nota ${i}`)
  assert.throws(() => parseNotes(['## Novidades', ...bullets].join('\n')), /entradas/)
})

test('falha no PUT mostra o motivo que o servidor deu', async () => {
  const res = new Response('{"error":"texto inválido"}', { status: 400 })
  assert.equal(
    await publishError('0.6.43', res),
    'PUT /api/changelog/0.6.43: HTTP 400 {"error":"texto inválido"}'
  )
})

test('--check valida o arquivo sem publicar (roda no affected-tests pr)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'changelog-'))
  const file = join(dir, 'next.md')
  const run = () => spawnSync(process.execPath, ['scripts/publish-changelog.mjs', '--check', file], { encoding: 'utf8' })
  writeFileSync(file, '## Novidades\n- Curta\n')
  assert.equal(run().status, 0)
  writeFileSync(file, `## Novidades\n- ${'x'.repeat(MAX_ENTRY_TEXT + 1)}\n`)
  const longa = run()
  assert.equal(longa.status, 1)
  assert.match(longa.stderr, /1001 caracteres/)
  assert.match(readFileSync(file, 'utf8'), /x{1001}/) // não esvaziou
})

test('--check sem arquivo mostra o uso', () => {
  const r = spawnSync(process.execPath, ['scripts/publish-changelog.mjs', '--check'], { encoding: 'utf8' })
  assert.equal(r.status, 1)
  assert.match(r.stderr, /uso:.*--check/)
})
