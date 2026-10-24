import assert from 'node:assert/strict'
import { test } from 'node:test'
import { nextVersion } from './next-version.mjs'

test('sobe um patch acima da versão publicada', () => {
  assert.equal(nextVersion('0.6.4', '0.6.0'), '0.6.5')
})

test('package.json mais novo (ex.: 0.7.0) vence a publicada', () => {
  assert.equal(nextVersion('0.6.9', '0.7.0'), '0.7.1')
})

test('sem nada publicado ainda, parte do package.json', () => {
  assert.equal(nextVersion('-', '0.6.0'), '0.6.1')
  assert.equal(nextVersion('', '0.6.0'), '0.6.1')
})

test('compara número a número, não como texto', () => {
  assert.equal(nextVersion('0.6.10', '0.6.9'), '0.6.11')
})
