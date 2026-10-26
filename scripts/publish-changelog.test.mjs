import assert from 'node:assert/strict'
import { test } from 'node:test'
import { EMPTY_NOTES, parseNotes } from './publish-changelog.mjs'

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
