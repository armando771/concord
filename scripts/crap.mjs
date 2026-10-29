// Gate de CRAP: mede as funções Go e TS tocadas e falha se alguma passar do
// limite (15). Roda a cobertura só dos pacotes/testes afetados.
//
//   node scripts/crap.mjs                     # diff contra origin/develop (ou origin/main)
//   node scripts/crap.mjs --base HEAD~3       # diff contra outra base
//   node scripts/crap.mjs --files a.go b.ts   # baseline: arquivos inteiros, antes de mexer
//   opções: --json, --limit N
//
// Go: precisa do `go` no PATH ou da variável GO apontando para o binário.
import { existsSync, mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { classify, goPackages } from './lib/affected.mjs'
import { evaluate, formatReport, LIMIT } from './lib/crap.mjs'
import { changedLines, codeChanges, defaultBase } from './lib/diff.mjs'
import { capture, GO, ROOT, run } from './lib/run.mjs'
import { tsFunctions } from './lib/ts-functions.mjs'

const isSource = (f) => existsSync(path.join(ROOT, f)) && !/(_test\.go|\.test\.tsx?|\.d\.ts)$/.test(f)

function parseArgs(argv) {
  const opts = { base: null, files: null, json: false, limit: LIMIT }
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === '--base') opts.base = argv[++i]
    else if (arg === '--limit') opts.limit = Number(argv[++i])
    else if (arg === '--json') opts.json = true
    else if (arg === '--files') opts.files = []
    else if (opts.files) opts.files.push(arg.replaceAll('\\', '/'))
  }
  return opts
}

function goFunctions(files, tmp) {
  if (!files.length) return []
  const backend = path.join(ROOT, 'backend')
  const profile = path.join(tmp, 'go.cover')
  if (run(GO, ['test', `-coverprofile=${profile}`, ...goPackages(files)], backend) !== 0) {
    console.warn('⚠️ go test falhou: a cobertura dos testes que falharam não conta')
  }
  if (!existsSync(profile)) fail('go test não gerou o coverprofile (erro de compilação?)')
  const rel = files.map((f) => f.slice('backend/'.length))
  const args = ['run', './tools/crap', '-cover', profile, ...rel]
  return JSON.parse(capture(GO, args, backend)).map((fn) => ({ ...fn, file: 'backend/' + fn.file }))
}

function tsCoverage(files, tmp) {
  const frontend = path.join(ROOT, 'frontend')
  const rel = files.map((f) => f.slice('frontend/'.length))
  const coverage = ['--coverage.enabled', '--coverage.provider=v8', '--coverage.reporter=json', `--coverage.reportsDirectory=${tmp}`]
  // Teste vermelho também é falha aqui: medir CRAP com testes quebrados engana.
  if (run('npx', ['vitest', 'related', '--run', '--passWithNoTests', ...coverage, ...rel.map((f) => `--coverage.include=${f}`), ...rel], frontend) !== 0) {
    fail('vitest falhou: corrija os testes antes de medir o CRAP')
  }
  const report = path.join(tmp, 'coverage-final.json')
  return existsSync(report) ? JSON.parse(readFileSync(report, 'utf8')) : {}
}

// Jest do mobile/: coverage-final.json (istanbul) só dos arquivos pedidos.
// Acima disso a linha de comando estoura o limite do Windows (PRs empilhados mexem em dezenas de arquivos):
// roda o Jest inteiro e deixa a cobertura ampla; o CRAP só avalia as funções dos arquivos tocados.
const MOBILE_MAX_FILES_ON_CLI = 25

function mobileCoverage(files, tmp) {
  const rel = files.map((f) => f.slice('mobile/'.length))
  const many = rel.length > MOBILE_MAX_FILES_ON_CLI
  const from = many ? ['src/**/*.{ts,tsx}', 'app/**/*.tsx'] : rel
  const coverage = ['--coverage', '--coverageReporters=json', `--coverageDirectory=${tmp}`, ...from.map((f) => `--collectCoverageFrom=${f}`)]
  const select = many ? [] : ['--findRelatedTests', '--passWithNoTests']
  if (run('npx', ['jest', ...select, ...coverage, ...(many ? [] : rel)], path.join(ROOT, 'mobile')) !== 0) {
    fail('jest falhou: corrija os testes antes de medir o CRAP')
  }
  const report = path.join(tmp, 'coverage-final.json')
  return existsSync(report) ? JSON.parse(readFileSync(report, 'utf8')) : {}
}

function fail(message) {
  console.error(`\n❌ ${message}`)
  process.exit(2)
}

function measure(files) {
  const tmp = mkdtempSync(path.join(tmpdir(), 'crap-'))
  const { go, ts, mobile } = classify(files)
  process.chdir(ROOT)
  return [
    ...goFunctions(go, tmp),
    ...(ts.length ? tsFunctions(ts, tsCoverage(ts, tmp)) : []),
    ...(mobile.length ? tsFunctions(mobile, mobileCoverage(mobile, tmp)) : [])
  ]
}

function main() {
  const opts = parseArgs(process.argv.slice(2))
  process.chdir(ROOT)
  const changes = opts.files ? Object.fromEntries(opts.files.map((f) => [f, []])) : codeChanges(changedLines(opts.base ?? defaultBase()))
  const files = Object.keys(changes).filter(isSource)
  const result = evaluate(measure(files), changes, { limit: opts.limit, wholeFile: Boolean(opts.files) })
  console.log('\n' + (opts.json ? JSON.stringify(result, null, 2) : formatReport(result, opts.limit)))
  process.exit(result.failures.length ? 1 : 0)
}

main()
