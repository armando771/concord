// Amarra o concordDsp.wasm commitado ao fonte de native/concord-dsp: o
// manifesto ao lado do .wasm guarda o hash do fonte que o gerou e o do
// próprio .wasm. scripts/build-dsp-wasm.sh grava; o teste confere.
//
//   node scripts/dsp-wasm.mjs write   # depois de compilar (o build-dsp-wasm.sh chama)
//   node scripts/dsp-wasm.mjs check   # sai com 1 se o .wasm ou o fonte mudaram sem rebuild
import { createHash } from 'node:crypto'
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { ROOT } from './lib/run.mjs'

const CRATE = 'native/concord-dsp'
/** Além do crate, o script de build (as flags dele mudam o .wasm). */
const EXTRA = ['scripts/build-dsp-wasm.sh']
export const WASM = 'frontend/src/renderer/src/features/call/lib/concordDsp.wasm'
export const MANIFEST = `${WASM}.json`

const sha256 = (data) => createHash('sha256').update(data).digest('hex')

/** Arquivos do crate (sem target/), relativos à raiz, em ordem estável. */
function crateFiles(root, dir = CRATE) {
  return readdirSync(path.join(root, dir))
    .filter((name) => name !== 'target')
    .flatMap((name) => {
      const rel = `${dir}/${name}`
      return statSync(path.join(root, rel)).isDirectory() ? crateFiles(root, rel) : [rel]
    })
}

/** Hash do fonte: caminho + conteúdo de cada arquivo, com CRLF normalizado para LF. */
export function sourceHash(root) {
  const hash = createHash('sha256')
  for (const file of [...crateFiles(root), ...EXTRA.filter((f) => existsSync(path.join(root, f)))].sort()) {
    const text = readFileSync(path.join(root, file), 'utf8').replaceAll('\r\n', '\n')
    hash.update(`${file}\0${text}\0`)
  }
  return hash.digest('hex')
}

/** O que está fora de sincronia entre fonte, .wasm e manifesto (vazio = ok). */
export function manifestErrors(root) {
  const manifest = JSON.parse(readFileSync(path.join(root, MANIFEST), 'utf8'))
  const errors = []
  if (manifest.source !== sourceHash(root)) {
    errors.push(`o fonte de ${CRATE} mudou depois do último build: rode scripts/build-dsp-wasm.sh`)
  }
  if (manifest.wasm !== sha256(readFileSync(path.join(root, WASM)))) {
    errors.push(`${WASM} não é o que o manifesto registra: rode scripts/build-dsp-wasm.sh`)
  }
  return errors
}

function write(root) {
  const manifest = { source: sourceHash(root), wasm: sha256(readFileSync(path.join(root, WASM))) }
  writeFileSync(path.join(root, MANIFEST), JSON.stringify(manifest, null, 2) + '\n')
}

function main() {
  const [command] = process.argv.slice(2)
  if (command === 'write') return write(ROOT)
  const errors = manifestErrors(ROOT)
  errors.forEach((e) => console.error(`❌ ${e}`))
  process.exitCode = errors.length ? 1 : 0
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) main()
