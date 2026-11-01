import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { test } from 'node:test'
import { manifestErrors, sourceHash } from './dsp-wasm.mjs'
import { ROOT } from './lib/run.mjs'

/** Um repo mínimo com o crate, o script de build, o .wasm e o manifesto. */
function fakeRepo(files) {
  const root = mkdtempSync(path.join(tmpdir(), 'dsp-wasm-'))
  for (const [file, content] of Object.entries(files)) {
    mkdirSync(path.dirname(path.join(root, file)), { recursive: true })
    writeFileSync(path.join(root, file), content)
  }
  return root
}

const CRATE = {
  'native/concord-dsp/Cargo.toml': '[package]\nname = "x"\n',
  'native/concord-dsp/src/lib.rs': 'pub fn a() {}\n',
  'scripts/build-dsp-wasm.sh': 'echo\n'
}

test('o hash do fonte não muda com CRLF (checkout no Windows)', () => {
  const lf = fakeRepo(CRATE)
  const crlf = fakeRepo(Object.fromEntries(Object.entries(CRATE).map(([f, c]) => [f, c.replaceAll('\n', '\r\n')])))
  assert.equal(sourceHash(lf), sourceHash(crlf))
})

test('o hash do fonte muda quando um .rs muda', () => {
  const a = fakeRepo(CRATE)
  const b = fakeRepo({ ...CRATE, 'native/concord-dsp/src/lib.rs': 'pub fn b() {}\n' })
  assert.notEqual(sourceHash(a), sourceHash(b))
})

test('o hash do fonte ignora o que o build gera (target/)', () => {
  const a = fakeRepo(CRATE)
  const b = fakeRepo({ ...CRATE, 'native/concord-dsp/target/release/x.rs': 'lixo' })
  assert.equal(sourceHash(a), sourceHash(b))
})

test('manifesto desatualizado aponta o que mudou', () => {
  const root = fakeRepo({
    ...CRATE,
    'frontend/src/renderer/src/features/call/lib/concordDsp.wasm': 'wasm',
    'frontend/src/renderer/src/features/call/lib/concordDsp.wasm.json': JSON.stringify({ source: 'velho', wasm: 'velho' })
  })
  const errors = manifestErrors(root)
  assert.equal(errors.length, 2)
  assert.match(errors[0], /fonte/)
  assert.match(errors[1], /\.wasm/)
})

test('o concordDsp.wasm commitado corresponde ao fonte de native/concord-dsp', () => {
  assert.deepEqual(manifestErrors(ROOT), [])
})
